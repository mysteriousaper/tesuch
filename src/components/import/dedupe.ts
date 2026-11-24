import { codeKey, type EmployeeInsert } from "../../lib/import";

export interface ExistingEmployee {
  /** Needed for re-sync: which saved employee a file row matches. */
  id?: string;
  full_name: string;
  birth_date: string | null;
  external_ref: string | null;
  /** Only read in privacy mode. */
  employee_code?: string | null;
}

export interface DedupeResult {
  keep: EmployeeInsert[];
  /** Rows skipped as certain duplicates (same employee ID, or same name + birth date). */
  skipped: number;
  /** Imported, but share a name with someone and have neither an employee ID nor a birth date to tell them apart. */
  possibleDuplicates: string[];
  /** Rows that are certain matches with a saved employee (same as `skipped`, with the saved employee's id), for re-sync. */
  matched: { candidate: EmployeeInsert; existingId: string | null }[];
}

const norm = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase();

/**
 * Decide which imported employees are already known, against the company's existing staff and earlier rows of the same file.
 * - Same employee_code (privacy mode) → same person (skip).
 * - A generated code says nothing about identity (the file had no code): such rows are compared by employee ID only,
 *   because in codes mode the name is the code. Without an employee ID they are imported as new.
 * - Same external_ref → same person (skip).
 * - Same name AND same birth date (both present) → same person (skip).
 * - Same name but nothing else to compare → could be two different people: import, but flag for the user.
 * A shared name alone never causes a row to be dropped.
 */
export function dedupeEmployees(candidates: EmployeeInsert[], existing: ExistingEmployee[], generated: ReadonlySet<string> = new Set()): DedupeResult {
  // Keys map to the saved employee's id (null for rows added earlier from this same file).
  const refs = new Map<string, string | null>();
  const nameBirth = new Map<string, string | null>();
  const names = new Set<string>();
  const codes = new Map<string, string | null>();
  const remember = (e: ExistingEmployee) => {
    const id = e.id ?? null;
    if (e.employee_code?.trim()) codes.set(codeKey(e.employee_code), id);
    if (e.external_ref?.trim()) refs.set(norm(e.external_ref), id);
    if (e.birth_date) nameBirth.set(`${norm(e.full_name)}|${e.birth_date}`, id);
    names.add(norm(e.full_name));
  };
  existing.forEach(remember);

  const result: DedupeResult = { keep: [], skipped: 0, possibleDuplicates: [], matched: [] };
  for (const e of candidates) {
    const ref = e.external_ref?.trim() ? norm(e.external_ref) : null;
    const name = norm(e.full_name);
    if (generated.has(e.id)) {
      if (ref && refs.has(ref)) { result.skipped++; result.matched.push({ candidate: e, existingId: refs.get(ref) ?? null }); }
      else { result.keep.push(e); remember(e); }
      continue;
    }
    if (e.employee_code) {
      // A code is unique per company: a known code is the same person, and a new code is never a name-only guess.
      const k = codeKey(e.employee_code);
      if (codes.has(k)) { result.skipped++; result.matched.push({ candidate: e, existingId: codes.get(k) ?? null }); }
      else { result.keep.push(e); remember(e); }
      continue;
    }
    const nb = e.birth_date ? `${name}|${e.birth_date}` : null;
    if ((ref && refs.has(ref)) || (nb && nameBirth.has(nb))) {
      result.skipped++;
      result.matched.push({ candidate: e, existingId: (ref && refs.get(ref)) || (nb ? nameBirth.get(nb) : null) || null });
      continue;
    }
    if (!ref && !e.birth_date && names.has(name)) result.possibleDuplicates.push(e.full_name);
    result.keep.push(e);
    remember(e);
  }
  return result;
}
