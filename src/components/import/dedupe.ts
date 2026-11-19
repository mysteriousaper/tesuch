import type { EmployeeInsert } from "@/lib/import";

export interface ExistingEmployee {
  full_name: string;
  birth_date: string | null;
  external_ref: string | null;
}

export interface DedupeResult {
  keep: EmployeeInsert[];
  /** Rows skipped as certain duplicates (same employee ID, or same name + birth date). */
  skipped: number;
  /** Imported, but share a name with someone and have neither an employee ID nor a birth date to tell them apart. */
  possibleDuplicates: string[];
}

const norm = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase();

/**
 * Decide which imported employees are already known, against the company's existing staff and earlier rows of the same file.
 * - Same external_ref → same person (skip).
 * - Same name AND same birth date (both present) → same person (skip).
 * - Same name but nothing else to compare → could be two different people: import, but flag for the user.
 * A shared name alone never causes a row to be dropped.
 */
export function dedupeEmployees(candidates: EmployeeInsert[], existing: ExistingEmployee[]): DedupeResult {
  const refs = new Set<string>();
  const nameBirth = new Set<string>();
  const names = new Set<string>();
  const remember = (e: ExistingEmployee) => {
    if (e.external_ref?.trim()) refs.add(norm(e.external_ref));
    if (e.birth_date) nameBirth.add(`${norm(e.full_name)}|${e.birth_date}`);
    names.add(norm(e.full_name));
  };
  existing.forEach(remember);

  const result: DedupeResult = { keep: [], skipped: 0, possibleDuplicates: [] };
  for (const e of candidates) {
    const ref = e.external_ref?.trim() ? norm(e.external_ref) : null;
    const name = norm(e.full_name);
    if ((ref && refs.has(ref)) || (e.birth_date && nameBirth.has(`${name}|${e.birth_date}`))) {
      result.skipped++;
      continue;
    }
    if (!ref && !e.birth_date && names.has(name)) result.possibleDuplicates.push(e.full_name);
    result.keep.push(e);
    remember(e);
  }
  return result;
}
