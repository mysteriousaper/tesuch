import { describe, expect, it } from "vitest";
import type { ContractInsert, EmployeeInsert, TargetField } from "../../lib/import";
import { planResync, type SavedContract, type SavedEmployee } from "./resync";

const emp = (over: Partial<EmployeeInsert> = {}): EmployeeInsert => ({ id: "n1", org_id: "o", company_id: "c", full_name: "Ա Բ", birth_date: null, six_day_week: false, external_ref: null, ...over });
const con = (over: Partial<ContractInsert> = {}): ContractInsert => ({
  id: "nc1", org_id: "o", employee_id: "n1", type: "indefinite", start_date: "2024-01-01", end_date: null, probation_end: null, probation_special_case: false,
  hired_by_transfer: false, fixed_term_ground: null, src_registered: null, terminated_on: null, termination_ground: null, termination_initiator: null,
  notice_given_on: null, workforce_reduction: false, ...over,
});
const savedEmp: SavedEmployee = { id: "s1", birth_date: "1990-01-01", six_day_week: false, external_ref: "AB-7" };
const savedCon = (over: Partial<SavedContract> = {}): SavedContract => con({ id: "sc1", employee_id: "s1", ...over });
const all = new Set<TargetField>(["birth_date", "six_day_week", "external_ref", "contract_type", "start_date", "end_date", "probation_end", "terminated_on"]);
const match = [{ candidate: emp({ birth_date: "1990-01-01", external_ref: "AB-7" }), existingId: "s1" }];

describe("planResync", () => {
  it("counts an identical row as unchanged", () => {
    const p = planResync(match, [con()], [savedEmp], [savedCon()], all);
    expect(p).toMatchObject({ changed: 0, unchanged: 1, contractPatches: [], contractInserts: [], employeePatches: [] });
  });

  it("patches a changed probation end and counts it once", () => {
    const p = planResync(match, [con({ probation_end: "2024-04-01" })], [savedEmp], [savedCon()], all);
    expect(p.changed).toBe(1);
    expect(p.contractPatches).toEqual([{ id: "sc1", patch: { probation_end: "2024-04-01" } }]);
  });

  it("sets the type together with a new end date", () => {
    const p = planResync(match, [con({ type: "fixed_term", end_date: "2025-01-01" })], [savedEmp], [savedCon()], all);
    expect(p.contractPatches[0].patch).toEqual({ end_date: "2025-01-01", type: "fixed_term" });
  });

  it("never wipes saved data with a blank cell", () => {
    const p = planResync(match, [con({ end_date: null, probation_end: null })], [savedEmp], [savedCon({ type: "fixed_term", end_date: "2025-01-01" })], new Set<TargetField>(["end_date", "probation_end", "start_date"]));
    expect(p.changed).toBe(0);
  });

  it("ignores columns that are not mapped", () => {
    const p = planResync(match, [con({ probation_end: "2024-04-01" })], [savedEmp], [savedCon()], new Set<TargetField>(["start_date"]));
    expect(p.changed).toBe(0);
  });

  it("adds a contract with a start date we do not have, under the saved employee", () => {
    const p = planResync(match, [con({ start_date: "2025-06-01" })], [savedEmp], [savedCon()], all);
    expect(p.changed).toBe(1);
    expect(p.contractInserts[0]).toMatchObject({ employee_id: "s1", start_date: "2025-06-01" });
  });

  it("updates employee details", () => {
    const m = [{ candidate: emp({ birth_date: "1991-02-02", external_ref: "AB-7" }), existingId: "s1" }];
    const p = planResync(m, [con()], [savedEmp], [savedCon()], all);
    expect(p.employeePatches).toEqual([{ id: "s1", patch: { birth_date: "1991-02-02" } }]);
  });
});
