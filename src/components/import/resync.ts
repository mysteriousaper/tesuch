import type { ContractInsert, EmployeeInsert, TargetField } from "../../lib/import";

/** Saved row shapes needed to compare with the file. */
export type SavedEmployee = Pick<EmployeeInsert, "birth_date" | "six_day_week" | "external_ref"> & { id: string };
export type SavedContract = Omit<ContractInsert, "org_id">;

export interface ResyncMatch {
  candidate: EmployeeInsert;
  existingId: string | null;
}

export interface ResyncPlan {
  employeePatches: { id: string; patch: Partial<EmployeeInsert> }[];
  contractPatches: { id: string; patch: Partial<ContractInsert> }[];
  /** A saved employee whose file row has a contract start date we do not have yet: added as a new contract. */
  contractInserts: ContractInsert[];
  changed: number;
  unchanged: number;
}

const EMPLOYEE_FIELDS = ["birth_date", "six_day_week", "external_ref"] as const;
const CONTRACT_FIELDS = [
  ["end_date", "end_date"], ["probation_end", "probation_end"], ["probation_special_case", "probation_special_case"],
  ["hired_by_transfer", "hired_by_transfer"], ["fixed_term_ground", "fixed_term_ground"], ["src_registered", "src_registered"],
  ["terminated_on", "terminated_on"], ["termination_ground", "termination_ground"], ["termination_initiator", "termination_initiator"],
  ["notice_given_on", "notice_given_on"], ["workforce_reduction", "workforce_reduction"],
] as const satisfies readonly (readonly [TargetField, keyof ContractInsert])[];

/**
 * Compare file rows that match saved employees with what is saved.
 * Only mapped columns are compared, and a blank file value never overwrites a saved one
 * (blank means "not in the file", not "cleared"), so a re-sync can fill in and correct but never wipe data.
 * A contract is matched by employee + start date; a different start date becomes a new contract.
 */
export function planResync(
  matched: ResyncMatch[], contracts: ContractInsert[], employees: SavedEmployee[], saved: SavedContract[], mapped: ReadonlySet<TargetField>,
): ResyncPlan {
  const emp = new Map(employees.map((e) => [e.id, e]));
  const plan: ResyncPlan = { employeePatches: [], contractPatches: [], contractInserts: [], changed: 0, unchanged: 0 };
  for (const { candidate, existingId } of matched) {
    const old = existingId ? emp.get(existingId) : undefined;
    if (!existingId || !old) { plan.unchanged++; continue; }
    let changed = false;

    const ePatch: Record<string, unknown> = {};
    for (const f of EMPLOYEE_FIELDS) {
      if (!mapped.has(f)) continue;
      const next = candidate[f];
      if (next === null || next === undefined) continue;
      if (next !== old[f]) ePatch[f] = next;
    }
    if (Object.keys(ePatch).length) { plan.employeePatches.push({ id: existingId, patch: ePatch as Partial<EmployeeInsert> }); changed = true; }

    for (const c of contracts.filter((x) => x.employee_id === candidate.id)) {
      const match = saved.find((s) => s.employee_id === existingId && s.start_date === c.start_date);
      if (!match) {
        plan.contractInserts.push({ ...c, employee_id: existingId });
        changed = true;
        continue;
      }
      const cPatch: Record<string, unknown> = {};
      for (const [target, col] of CONTRACT_FIELDS) {
        if (!mapped.has(target)) continue;
        const next = c[col];
        if (next === null || next === undefined) continue;
        if (next !== match[col]) cPatch[col] = next;
      }
      // contract_type column or an end date both decide the type; an end date needs a fixed-term type (DB check).
      if ((mapped.has("contract_type") || "end_date" in cPatch) && c.type !== match.type) cPatch.type = c.type;
      if (Object.keys(cPatch).length) { plan.contractPatches.push({ id: match.id, patch: cPatch as Partial<ContractInsert> }); changed = true; }
    }
    if (changed) plan.changed++;
    else plan.unchanged++;
  }
  return plan;
}
