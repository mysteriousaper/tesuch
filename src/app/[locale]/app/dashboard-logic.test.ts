import { describe, expect, it, vi } from "vitest";
import {
  canEditRole, companySchema, editSchema, employeeSchema, findingStatusSchema, insertDemo, insertEmployeeWithContract,
  latestContract, leaveSchema, splitEmployee, type DemoWriter, type EmployeeWriter,
} from "./dashboard-logic";
import { generateDemoCompanies } from "./demo-data";

const UUID = "11111111-1111-4111-8111-111111111111";

/** A form as the browser submits it: only rendered fields, checkboxes as "on". */
const form = (o: Record<string, string> = {}) => ({ full_name: "Աննա Պետրոսյան", type: "indefinite", start_date: "2026-01-10", ...o });

describe("canEditRole", () => {
  it("lets owners and accountants edit, never viewers or strangers", () => {
    expect(canEditRole("owner")).toBe(true);
    expect(canEditRole("accountant")).toBe(true);
    expect(canEditRole("viewer")).toBe(false);
    expect(canEditRole(null)).toBe(false);
    expect(canEditRole(undefined)).toBe(false);
    expect(canEditRole("admin")).toBe(false);
  });
});

describe("companySchema", () => {
  it("accepts a name with an optional 8-digit tax id", () => {
    expect(companySchema.parse({ name: " Դեմո ՍՊԸ ", tax_id: "" })).toEqual({ name: "Դեմո ՍՊԸ", tax_id: null });
    expect(companySchema.parse({ name: "X", tax_id: null })).toEqual({ name: "X", tax_id: null });
    expect(companySchema.parse({ name: "X", tax_id: "01234567" }).tax_id).toBe("01234567");
  });
  it("rejects a blank name or a malformed tax id", () => {
    expect(companySchema.safeParse({ name: "  ", tax_id: "" }).success).toBe(false);
    expect(companySchema.safeParse({ name: "X", tax_id: "1234567" }).success).toBe(false);
    expect(companySchema.safeParse({ name: "X", tax_id: "1234567a" }).success).toBe(false);
  });
});

describe("employeeSchema", () => {
  it("accepts an indefinite contract when optional fields are not rendered at all", () => {
    // Regression: the fixed-term ground input is absent for indefinite contracts.
    const v = employeeSchema.parse(form());
    expect(v).toMatchObject({ end_date: null, probation_end: null, birth_date: null, fixed_term_ground: null, six_day_week: false, src_registered: null });
  });
  it("reads checkboxes and trims text", () => {
    const v = employeeSchema.parse(form({ type: "fixed_term", end_date: "2026-12-31", fixed_term_ground: "  Սեզոնային  ", six_day_week: "on", src_registered: "yes" }));
    expect(v).toMatchObject({ fixed_term_ground: "Սեզոնային", six_day_week: true, src_registered: true });
  });
  it("maps a blank fixed-term ground to none stated (empty string), but indefinite stays null", () => {
    expect(employeeSchema.parse(form({ type: "fixed_term", end_date: "2026-12-31", fixed_term_ground: "  " })).fixed_term_ground).toBe("");
    expect(employeeSchema.parse(form({ type: "fixed_term", end_date: "2026-12-31" })).fixed_term_ground).toBe("");
    expect(editSchema.parse(form({ type: "fixed_term", end_date: "2026-12-31", fixed_term_ground: "" })).fixed_term_ground).toBe("");
    expect(employeeSchema.parse(form({ fixed_term_ground: "" })).fixed_term_ground).toBeNull();
  });
  it("reads SRC status as tri-state: blank is unknown, never false", () => {
    expect(employeeSchema.parse(form({ src_registered: "" })).src_registered).toBeNull();
    expect(employeeSchema.parse(form({ src_registered: "no" })).src_registered).toBe(false);
    expect(employeeSchema.parse(form({ src_registered: "yes" })).src_registered).toBe(true);
  });
  it("mirrors the database contract checks", () => {
    expect(employeeSchema.safeParse(form({ end_date: "2026-12-31" })).success).toBe(false); // indefinite with an end date
    expect(employeeSchema.safeParse(form({ type: "fixed_term", end_date: "2026-01-09" })).success).toBe(false); // ends before start
    expect(employeeSchema.safeParse(form({ probation_end: "2026-01-09" })).success).toBe(false); // probation before start
    expect(employeeSchema.safeParse(form({ type: "fixed_term", end_date: "2026-01-10" })).success).toBe(true); // same day is fine
  });
  it("rejects missing names, bad dates and unknown contract types", () => {
    expect(employeeSchema.safeParse(form({ full_name: " " })).success).toBe(false);
    expect(employeeSchema.safeParse(form({ start_date: "10.01.2026" })).success).toBe(false);
    expect(employeeSchema.safeParse(form({ type: "temporary" })).success).toBe(false);
  });
});

describe("editSchema", () => {
  it("accepts termination data and treats an empty initiator as none", () => {
    const v = editSchema.parse(form({ terminated_on: "2026-06-30", notice_given_on: "2026-05-01", termination_initiator: "employer", workforce_reduction: "on" }));
    expect(v).toMatchObject({ terminated_on: "2026-06-30", termination_initiator: "employer", workforce_reduction: true });
    expect(editSchema.parse(form({ termination_initiator: "" })).termination_initiator).toBeNull();
  });
  it("rejects impossible termination dates and unknown initiators", () => {
    expect(editSchema.safeParse(form({ terminated_on: "2025-12-31" })).success).toBe(false); // before start
    expect(editSchema.safeParse(form({ terminated_on: "2026-06-30", notice_given_on: "2026-07-01" })).success).toBe(false); // notice after end
    expect(editSchema.safeParse(form({ termination_initiator: "boss" })).success).toBe(false);
  });
});

describe("leaveSchema", () => {
  it("coerces days and enforces 1–400", () => {
    expect(leaveSchema.parse({ type: "annual", start_date: "2026-07-01", days: "20" }).days).toBe(20);
    expect(leaveSchema.safeParse({ type: "annual", start_date: "2026-07-01", days: "0" }).success).toBe(false);
    expect(leaveSchema.safeParse({ type: "annual", start_date: "2026-07-01", days: "401" }).success).toBe(false);
    expect(leaveSchema.safeParse({ type: "annual", start_date: "2026-07-01", days: "2.5" }).success).toBe(false);
    expect(leaveSchema.safeParse({ type: "sick", start_date: "2026-07-01", days: "3" }).success).toBe(false);
  });
});

describe("findingStatusSchema", () => {
  it("requires real ids and a known status", () => {
    expect(findingStatusSchema.safeParse({ companyId: UUID, findingId: UUID, status: "fixed" }).success).toBe(true);
    expect(findingStatusSchema.safeParse({ companyId: "x", findingId: UUID, status: "fixed" }).success).toBe(false);
    expect(findingStatusSchema.safeParse({ companyId: UUID, findingId: UUID, status: "deleted" }).success).toBe(false);
  });
});

describe("splitEmployee", () => {
  it("separates employee columns from contract columns", () => {
    const { employee, contract } = splitEmployee(employeeSchema.parse(form({ birth_date: "1990-01-01" })));
    expect(employee).toEqual({ full_name: "Աննա Պետրոսյան", birth_date: "1990-01-01", six_day_week: false });
    expect(contract).toMatchObject({ type: "indefinite", start_date: "2026-01-10" });
    expect(contract).not.toHaveProperty("full_name");
  });
});

describe("insertEmployeeWithContract", () => {
  const writer = (o: Partial<EmployeeWriter> = {}): EmployeeWriter & { deleteEmployee: ReturnType<typeof vi.fn> } => ({
    insertEmployee: vi.fn(async () => "emp-1"),
    insertContract: vi.fn(async () => undefined),
    deleteEmployee: vi.fn(async () => undefined),
    ...o,
  }) as never;
  const emp = { full_name: "A", birth_date: null, six_day_week: false };

  it("inserts the employee then the contract", async () => {
    const w = writer();
    expect(await insertEmployeeWithContract(w, emp, { type: "indefinite" })).toEqual({ ok: true, employeeId: "emp-1" });
    expect(w.insertContract).toHaveBeenCalledWith("emp-1", { type: "indefinite" });
    expect(w.deleteEmployee).not.toHaveBeenCalled();
  });
  it("deletes the employee when the contract insert fails (no orphans)", async () => {
    const w = writer({ insertContract: vi.fn(async () => { throw new Error("check violation"); }) });
    expect(await insertEmployeeWithContract(w, emp, {})).toEqual({ ok: false });
    expect(w.deleteEmployee).toHaveBeenCalledWith("emp-1");
  });
  it("does not try to delete anything when the employee insert itself fails", async () => {
    const w = writer({ insertEmployee: vi.fn(async () => { throw new Error("rls"); }) });
    expect(await insertEmployeeWithContract(w, emp, {})).toEqual({ ok: false });
    expect(w.insertContract).not.toHaveBeenCalled();
    expect(w.deleteEmployee).not.toHaveBeenCalled();
  });
  it("still reports failure if the cleanup itself fails", async () => {
    const w = writer({
      insertContract: vi.fn(async () => { throw new Error("x"); }),
      deleteEmployee: vi.fn(async () => { throw new Error("network"); }),
    });
    expect(await insertEmployeeWithContract(w, emp, {})).toEqual({ ok: false });
  });
});

describe("insertDemo", () => {
  const demo = generateDemoCompanies("2026-11-18", 3, 3, 2);

  function fakeWriter(failAt?: { method: keyof DemoWriter; call: number }) {
    let n = 0;
    const calls: Record<string, number> = {};
    const step = (method: keyof DemoWriter) => {
      calls[method] = (calls[method] ?? 0) + 1;
      if (failAt && failAt.method === method && failAt.call === calls[method]) throw new Error(`${method} failed`);
    };
    const w = {
      insertCompany: vi.fn(async () => { step("insertCompany"); return `co-${++n}`; }),
      insertEmployee: vi.fn(async () => { step("insertEmployee"); return `emp-${++n}`; }),
      insertContract: vi.fn(async () => { step("insertContract"); }),
      insertLeave: vi.fn(async () => { step("insertLeave"); }),
      deleteCompanies: vi.fn(async (ids: string[]) => { void ids; }),
    };
    return w;
  }

  it("inserts every company, employee and contract and returns the company ids in order", async () => {
    const w = fakeWriter();
    const r = await insertDemo(w, demo);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.companyIds).toHaveLength(3);
    expect(w.insertEmployee).toHaveBeenCalledTimes(6);
    expect(w.insertContract).toHaveBeenCalledTimes(6);
    expect(w.deleteCompanies).not.toHaveBeenCalled();
  });
  it("rolls back every company created in this run when a later step fails", async () => {
    const w = fakeWriter({ method: "insertContract", call: 3 }); // first contract of the second company
    expect(await insertDemo(w, demo)).toEqual({ ok: false });
    expect(w.deleteCompanies).toHaveBeenCalledTimes(1);
    const deleted = w.deleteCompanies.mock.calls[0][0];
    expect(deleted).toHaveLength(2);
    expect(deleted.every((id) => id.startsWith("co-"))).toBe(true);
    expect(w.insertCompany).toHaveBeenCalledTimes(2); // stopped at the failure
  });
  it("has nothing to roll back when the very first insert fails", async () => {
    const w = fakeWriter({ method: "insertCompany", call: 1 });
    expect(await insertDemo(w, demo)).toEqual({ ok: false });
    expect(w.deleteCompanies).not.toHaveBeenCalled();
  });
  it("reports failure even if the rollback itself fails", async () => {
    const w = fakeWriter({ method: "insertEmployee", call: 1 });
    w.deleteCompanies.mockRejectedValueOnce(new Error("network"));
    expect(await insertDemo(w, demo)).toEqual({ ok: false });
  });
});

describe("latestContract", () => {
  it("picks the most recently started contract regardless of order", () => {
    const k = [{ id: "a", start_date: "2020-01-01" }, { id: "c", start_date: "2025-03-01" }, { id: "b", start_date: "2023-06-01" }];
    expect(latestContract(k)?.id).toBe("c");
    expect(k.map((x) => x.id)).toEqual(["a", "c", "b"]); // input not mutated
  });
  it("handles no contracts", () => {
    expect(latestContract([])).toBeUndefined();
    expect(latestContract(null)).toBeUndefined();
  });
});
