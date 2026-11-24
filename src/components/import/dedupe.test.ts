import { describe, expect, it } from "vitest";
import type { EmployeeInsert } from "../../lib/import";
import { dedupeEmployees, type ExistingEmployee } from "./dedupe";

let n = 0;
const emp = (full_name: string, birth_date: string | null = null, external_ref: string | null = null): EmployeeInsert => ({
  id: `e${++n}`, org_id: "o", company_id: "c", full_name, birth_date, six_day_week: false, external_ref,
});
const old = (full_name: string, birth_date: string | null = null, external_ref: string | null = null): ExistingEmployee => ({ full_name, birth_date, external_ref });

describe("dedupeEmployees", () => {
  it("keeps everyone when nothing matches", () => {
    const r = dedupeEmployees([emp("Ա Բ", "1990-01-01"), emp("Գ Դ")], [old("Ե Զ", "1980-01-01")]);
    expect(r.keep).toHaveLength(2);
    expect(r).toMatchObject({ skipped: 0, possibleDuplicates: [] });
  });

  it("skips a matching employee ID (case and spaces ignored), even with a different name", () => {
    const r = dedupeEmployees([emp("Other Name", null, " ab-7 ")], [old("Ա Բ", null, "AB-7")]);
    expect(r).toMatchObject({ keep: [], skipped: 1 });
  });

  it("skips same name + same birth date", () => {
    const r = dedupeEmployees([emp("Արամ  Պետրոսյան", "1990-01-01")], [old("արամ պետրոսյան", "1990-01-01")]);
    expect(r.skipped).toBe(1);
  });

  it("keeps same name with a different birth date (two different people)", () => {
    const r = dedupeEmployees([emp("Արամ Պետրոսյան", "1991-05-05")], [old("Արամ Պետրոսյան", "1990-01-01")]);
    expect(r).toMatchObject({ skipped: 0, possibleDuplicates: [] });
    expect(r.keep).toHaveLength(1);
  });

  it("never drops a same-name row with no birth date and no ID: imports it and flags it", () => {
    const r = dedupeEmployees([emp("Արամ Պետրոսյան")], [old("Արամ Պետրոսյան")]);
    expect(r.keep).toHaveLength(1);
    expect(r.skipped).toBe(0);
    expect(r.possibleDuplicates).toEqual(["Արամ Պետրոսյան"]);
  });

  it("flags same-name rows within the same file instead of dropping them", () => {
    const r = dedupeEmployees([emp("Анна Иванова"), emp("Анна Иванова")], []);
    expect(r.keep).toHaveLength(2);
    expect(r.possibleDuplicates).toEqual(["Анна Иванова"]);
  });

  it("does not flag a row that has its own employee ID", () => {
    const r = dedupeEmployees([emp("Анна Иванова", null, "200")], [old("Анна Иванова", null, "100")]);
    expect(r).toMatchObject({ skipped: 0, possibleDuplicates: [] });
  });

  it("skips repeats within the same file by ID or by name + birth date", () => {
    const r = dedupeEmployees([emp("A", null, "1"), emp("B", null, "1"), emp("C", "2000-01-01"), emp("c", "2000-01-01")], []);
    expect(r.keep.map((e) => e.full_name)).toEqual(["A", "C"]);
    expect(r.skipped).toBe(2);
  });
});

describe("dedupe by employee code (privacy mode)", () => {
  const coded = (code: string): EmployeeInsert => ({ ...emp(code), employee_code: code });
  it("skips a code that already exists in the company, case-insensitively, and never flags it as a name match", () => {
    const r = dedupeEmployees([coded("EMP-1"), coded("EMP-2")], [{ full_name: "emp-1", birth_date: null, external_ref: null, employee_code: "emp-1" }]);
    expect(r.keep.map((e) => e.employee_code)).toEqual(["EMP-2"]);
    expect(r.skipped).toBe(1);
    expect(r.possibleDuplicates).toEqual([]);
  });
});

describe("generated codes (codes mode, file without a code column)", () => {
  const row = (id: string, code: string, ref: string | null) => ({ id, org_id: "o", company_id: "c", full_name: code, employee_code: code, birth_date: null, six_day_week: false, external_ref: ref });
  it("skips a re-imported row by employee ID even though its generated code is new", () => {
    const r = dedupeEmployees([row("n1", "EMP-003", "A1"), row("n2", "EMP-004", "A9")], [{ full_name: "EMP-001", birth_date: null, external_ref: "A1", employee_code: "EMP-001" }], new Set(["n1", "n2"]));
    expect(r.skipped).toBe(1);
    expect(r.keep.map((e) => e.id)).toEqual(["n2"]);
  });
});

describe("dedupeEmployees matched (re-sync)", () => {
  it("returns the saved id of a matched employee", () => {
    const r = dedupeEmployees([emp("Ա Բ", null, "AB-7")], [{ id: "saved-1", full_name: "Ա Բ", birth_date: null, external_ref: "ab-7" }]);
    expect(r.matched).toEqual([{ candidate: expect.objectContaining({ full_name: "Ա Բ" }), existingId: "saved-1" }]);
  });
});
