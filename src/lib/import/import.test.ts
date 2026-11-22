import { describe, expect, it } from "vitest";
import { RULES } from "../rules/catalog";
import { evaluateCompany } from "../rules/engine";
import type { Contract, Employee } from "../rules/types";
import {
  autoMap,
  detectHeaderRow,
  buildImport,
  excelSerialToIso,
  missingRequiredFields,
  parseBool,
  parseContractType,
  parseCsv,
  parseDate,
  parseGround,
  parseInitiator,
  toMapping,
  toTable,
  unmappedImpact,
} from "./index";

const ids = () => {
  let n = 0;
  return () => `id-${++n}`;
};
const opts = () => ({ orgId: "org", companyId: "co", newId: ids() });

describe("parseDate", () => {
  it.each([
    ["15.01.2026", "2026-01-15"],
    ["5.1.2026", "2026-01-05"],
    ["15/01/2026", "2026-01-15"],
    ["15-01-2026", "2026-01-15"],
    ["2026-01-15", "2026-01-15"],
    ["2026-01-15T00:00:00Z", "2026-01-15"],
    ["29.02.2028", "2028-02-29"],
    ["46037", "2026-01-15"],
  ])("%s → %s", (input, expected) => {
    expect(parseDate(input)).toEqual({ ok: true, value: expected });
  });
  it("accepts Excel serials and Date objects", () => {
    expect(parseDate(46037)).toEqual({ ok: true, value: "2026-01-15" });
    expect(parseDate(new Date(Date.UTC(2026, 0, 15)))).toEqual({ ok: true, value: "2026-01-15" });
  });
  it("is exact from 1 March 1900 and rejects the ambiguous earlier serials", () => {
    expect(excelSerialToIso(61)).toBe("1900-03-01");
    expect(excelSerialToIso(1)).toBeNull(); // Excel's fake 29 Feb 1900 makes serials < 61 off by one
    expect(excelSerialToIso(0)).toBeNull();
  });
  it("treats blanks as null", () => {
    expect(parseDate("  ")).toEqual({ ok: true, value: null });
    expect(parseDate(null)).toEqual({ ok: true, value: null });
  });
  it.each(["29.02.2026", "31.04.2026", "2026-13-01", "tomorrow", "01.15.2026", "15.01.26"])("rejects %s", (input) => {
    expect(parseDate(input).ok).toBe(false);
  });
});

describe("parseBool / contract type / initiator", () => {
  it.each(["Այո", "да", "Yes", "1", "TRUE", "+"])("%s is true", (v) => expect(parseBool(v)).toEqual({ ok: true, value: true }));
  it.each(["ոչ", "Нет", "no", "0", "-"])("%s is false", (v) => expect(parseBool(v)).toEqual({ ok: true, value: false }));
  it.each(["", "  ", null, undefined])("%j is unknown (null), not false", (v) => expect(parseBool(v)).toEqual({ ok: true, value: null }));
  it("rejects unknown words", () => expect(parseBool("maybe").ok).toBe(false));

  it.each([
    ["Անորոշ ժամկետով", "indefinite"],
    ["бессрочный", "indefinite"],
    ["Permanent", "indefinite"],
    ["Որոշակի ժամկետով", "fixed_term"],
    ["Срочный", "fixed_term"],
    ["fixed-term", "fixed_term"],
  ])("contract type %s → %s", (v, expected) => expect(parseContractType(v)).toEqual({ ok: true, value: expected }));

  it.each([
    ["Գործատու", "employer"],
    ["по собственному желанию", "employee"],
    ["Կողմերի համաձայնությամբ", "mutual"],
  ])("initiator %s → %s", (v, expected) => expect(parseInitiator(v)).toEqual({ ok: true, value: expected }));
});

describe("autoMap", () => {
  it("maps Armenian headers", () => {
    const m = toMapping(autoMap(["Անուն Ազգանուն", "Ծննդյան ամսաթիվ", "Ընդունման ամսաթիվ", "Փորձաշրջանի ավարտ", "Պայմանագրի տեսակ"]));
    expect(m).toEqual({ 0: "full_name", 1: "birth_date", 2: "start_date", 3: "probation_end", 4: "contract_type" });
  });
  it("maps Russian headers, including punctuation and ё", () => {
    const m = toMapping(autoMap(["ФИО", "Дата рождения:", "Дата приёма", "Дата окончания договора", "Окончание испытательного срока", "Табельный №"]));
    expect(m).toEqual({ 0: "full_name", 1: "birth_date", 2: "start_date", 3: "end_date", 4: "probation_end", 5: "external_ref" });
  });
  it("maps English headers and separate name parts", () => {
    const m = toMapping(autoMap(["Last name", "First name", "Hire date", "Termination date", "Notes"]));
    expect(m).toEqual({ 0: "last_name", 1: "first_name", 2: "start_date", 3: "terminated_on", 4: null });
  });
  it("gives exact matches confidence 1 and partial matches less", () => {
    const g = autoMap(["Дата рождения", "Дата рождения сотрудника"]);
    expect(g[0]).toMatchObject({ field: "birth_date", confidence: 1 });
    expect(g[1].field).not.toBe("birth_date"); // each field used once
  });
  it("partial match scores below 1", () => {
    const [g] = autoMap(["Ծննդյան ամսաթիվ (օր.ամիս.տարի)"]);
    expect(g.field).toBe("birth_date");
    expect(g.confidence).toBeGreaterThan(0.5);
    expect(g.confidence).toBeLessThan(1);
  });
  it("does not match short aliases inside other words", () => {
    expect(autoMap(["Video"])[0].field).toBeNull();
  });
  it("reports missing required fields", () => {
    expect(missingRequiredFields({ 0: "birth_date" })).toEqual(["full_name", "start_date"]);
    expect(missingRequiredFields({ 0: "first_name", 1: "last_name", 2: "start_date" })).toEqual([]);
  });
});

describe("CSV → insert rows", () => {
  const csv = [
    "﻿Անուն Ազգանուն;Ծննդյան ամսաթիվ;Ընդունման ամսաթիվ;Պայմանագրի ավարտ;Փորձաշրջանի ավարտ;Վեցօրյա;ՊԵԿ-ում գրանցված",
    "Արամ Պետրոսյան;10.05.1990;15.01.2026;;14.04.2026;ոչ;այո",
    ";;;;;;",
    "Անի Սարգսյան;01.02.2009;15.01.2026;31.12.2026;15.04.2026;այո;ոչ",
    "Գոռ Հակոբյան;31.02.1990;15.01.2026;;;;",
    ";01.01.1990;;;;;",
    "Լիլիթ Գրիգորյան;01.01.1990;15.01.2026;01.01.2026;;;",
  ].join("\n");

  const table = toTable(parseCsv(csv));
  const result = buildImport(table, toMapping(autoMap(table.headers)), opts());

  it("detects ; delimiter, strips BOM, skips blank rows but keeps row numbers", () => {
    expect(table.headers[0]).toBe("Անուն Ազգանուն");
    expect(table.rows.map((r) => r.rowNumber)).toEqual([2, 4, 5, 6, 7]);
  });

  it("outputs insert-ready employees and contracts", () => {
    expect(result.employees).toEqual([
      { id: "id-1", org_id: "org", company_id: "co", full_name: "Արամ Պետրոսյան", birth_date: "1990-05-10", six_day_week: false, external_ref: null },
      { id: "id-3", org_id: "org", company_id: "co", full_name: "Անի Սարգսյան", birth_date: "2009-02-01", six_day_week: true, external_ref: null },
    ]);
    expect(result.contracts[0]).toMatchObject({ id: "id-2", employee_id: "id-1", type: "indefinite", start_date: "2026-01-15", probation_end: "2026-04-14", src_registered: true });
    expect(result.contracts[1]).toMatchObject({ employee_id: "id-3", type: "fixed_term", end_date: "2026-12-31", src_registered: false });
  });

  it("returns per-row errors with message keys and never throws", () => {
    expect(result.errors).toEqual([
      { row: 5, field: "birth_date", key: "import.error.invalidDate" },
      { row: 6, field: "full_name", key: "import.error.required" },
      { row: 6, field: "start_date", key: "import.error.required" },
      { row: 7, field: "end_date", key: "import.error.endBeforeStart" },
    ]);
    expect(result.rowCount).toBe(5);
  });

  it("feeds straight into the rules engine", async () => {
    const employees: Employee[] = result.employees.map((e) => ({ id: e.id, companyId: e.company_id, birthDate: e.birth_date, sixDayWeek: e.six_day_week }));
    const contracts: Contract[] = result.contracts.map((c) => ({
      id: c.id, employeeId: c.employee_id, type: c.type, startDate: c.start_date, endDate: c.end_date,
      probationEnd: c.probation_end, probationSpecialCase: c.probation_special_case, hiredByTransfer: c.hired_by_transfer,
      fixedTermGround: c.fixed_term_ground, srcRegistered: c.src_registered, terminatedOn: c.terminated_on,
      terminationGround: c.termination_ground, terminationInitiator: c.termination_initiator,
      noticeGivenOn: c.notice_given_on, workforceReduction: c.workforce_reduction,
    }));
    const found = (await evaluateCompany(RULES, { employees, contracts, leave: [] }, "2026-02-01")).map((f) => `${f.employeeId}:${f.ruleId}`);
    // Ani: minor on probation, probation one day over 3 months, not registered with SRC.
    // Her fixed-term ground is blank in the file: unknown, so that rule must not fire.
    expect(found).toEqual(["id-3:probation-max", "id-3:probation-minor", "id-3:src-registration"]);
  });

  it("keeps blank and unmapped tri-state values as unknown and never floods findings", async () => {
    const t = toTable(parseCsv("Name;Hire date;End date;SRC\nA B;15.01.2025;31.12.2026;\nC D;15.01.2025;31.12.2026;ոչ"));
    const withCol = buildImport(t, toMapping(autoMap(t.headers)), opts());
    expect(withCol.contracts.map((c) => c.src_registered)).toEqual([null, false]);
    expect(withCol.contracts.map((c) => c.fixed_term_ground)).toEqual([null, null]);
    const noCol = buildImport(t, { 0: "full_name", 1: "start_date", 2: "end_date" }, opts());
    expect(noCol.contracts.every((c) => c.src_registered === null && c.fixed_term_ground === null)).toBe(true);
    const contracts: Contract[] = noCol.contracts.map((c) => ({
      id: c.id, employeeId: c.employee_id, type: c.type, startDate: c.start_date, endDate: c.end_date, probationEnd: null,
      probationSpecialCase: false, hiredByTransfer: false, fixedTermGround: c.fixed_term_ground, srcRegistered: c.src_registered,
      terminatedOn: null, terminationGround: null, terminationInitiator: null, noticeGivenOn: null, workforceReduction: false,
    }));
    const employees: Employee[] = noCol.employees.map((e) => ({ id: e.id, companyId: "co", birthDate: null, sixDayWeek: false }));
    const found = await evaluateCompany(RULES, { employees, contracts, leave: [] }, "2026-02-01");
    expect(found.map((f) => f.ruleId)).toEqual([]);
  });

  it("reads an explicit 'none' ground as empty (stated as absent), so the rule can fire", () => {
    expect(parseGround("нет")).toEqual({ ok: true, value: "" });
    expect(parseGround("")).toEqual({ ok: true, value: null });
    expect(parseGround("Сезонная работа")).toEqual({ ok: true, value: "Сезонная работа" });
  });

  it("lists unmapped optional fields with their rules", () => {
    expect(unmappedImpact({ 0: "full_name", 1: "start_date" }).map((u) => u.field).sort()).toEqual(["birth_date", "fixed_term_ground", "src_registered"]);
    expect(unmappedImpact({ 0: "src_registered", 1: "fixed_term_ground", 2: "birth_date" })).toEqual([]);
  });
});

describe("row pipeline with Excel-typed cells", () => {
  it("handles Date, number and boolean cells as read-excel-file returns them", () => {
    const table = toTable([
      ["Full name", "Date of birth", "Hire date", "Contract type", "Contract end", "Six-day week", "Termination initiator"],
      ["Test Person", new Date(Date.UTC(1990, 4, 10)), 46037, "Fixed-term", 46387, true, null],
    ]);
    const r = buildImport(table, toMapping(autoMap(table.headers)), opts());
    expect(r.errors).toEqual([]);
    expect(r.employees[0]).toMatchObject({ birth_date: "1990-05-10", six_day_week: true });
    expect(r.contracts[0]).toMatchObject({ type: "fixed_term", start_date: "2026-01-15", end_date: "2026-12-31" });
  });

  it("flags explicit contract-type contradictions", () => {
    const table = toTable([
      ["Name", "Start date", "End date", "Contract type"],
      ["A", "2026-01-01", "2026-06-30", "бессрочный"],
      ["B", "2026-01-01", "", "срочный"],
      ["C", "2026-01-01", "", "unknown"],
    ]);
    const r = buildImport(table, toMapping(autoMap(table.headers)), opts());
    expect(r.errors).toEqual([
      { row: 2, field: "end_date", key: "import.error.endDateOnIndefinite" },
      { row: 3, field: "end_date", key: "import.error.fixedTermWithoutEnd" },
      { row: 4, field: "contract_type", key: "import.error.invalidContractType" },
    ]);
    expect(r.employees).toEqual([]);
  });

  it("builds full name from last + first + patronymic and honours user overrides", () => {
    const table = toTable([
      ["Фамилия", "Имя", "Отчество", "Колонка X"],
      ["Петросян", "Арам", "Ваганович", "01.03.2026"],
    ]);
    const mapping = { ...toMapping(autoMap(table.headers)), 3: "start_date" as const };
    const r = buildImport(table, mapping, opts());
    expect(r.employees[0].full_name).toBe("Петросян Арам Ваганович");
    expect(r.contracts[0].start_date).toBe("2026-03-01");
  });
});

describe("header-row detection", () => {
  const title = [["Staff list 2026", "", "", ""], ["Total employees: 2", "", "", ""], ["", "", "", ""]];
  const header = ["Full name", "Date of birth", "Hire date", "Contract end"];
  const data = [["A B", "01.01.1990", "01.02.2026", ""], ["C D", "02.02.1991", "01.03.2026", ""]];

  it("finds the header below title/summary rows and keeps 1-based row numbers", () => {
    const grid = [...title, header, ...data];
    expect(detectHeaderRow(grid)).toBe(4);
    const t = toTable(grid);
    expect(t.headers).toEqual(header);
    expect(t.rows.map((r) => r.rowNumber)).toEqual([5, 6]);
  });

  it("falls back to the first non-empty row when nothing is recognisable", () => {
    const grid = [[""], ["Foo", "Bar"], ["x", "y"]];
    expect(detectHeaderRow(grid)).toBe(2);
    expect(toTable(grid).headers).toEqual(["Foo", "Bar"]);
    expect(detectHeaderRow([[""], []])).toBeNull();
    expect(toTable([]).headers).toEqual([]);
  });

  it("uses the manual override (1-based) instead of detection", () => {
    const grid = [...title, header, ...data];
    const t = toTable(grid, { headerRow: 2 });
    expect(t.headers[0]).toBe("Total employees: 2");
    expect(t.rows[0].rowNumber).toBe(4);
    expect(toTable(grid, { headerRow: 99 })).toEqual({ headers: [], rows: [] });
    expect(toTable(grid, { headerRow: 0 })).toEqual({ headers: [], rows: [] });
  });
});

describe("privacy mode import", () => {
  const csv = [
    "Табельный номер;ФИО;Дата приёма",
    "EMP-001;Иван Иванов;15.01.2026",
    "EMP-002;;16.01.2026",
    "emp-001;Другой;17.01.2026",
    ";Без кода;18.01.2026",
    `${"x".repeat(41)};Длинный;19.01.2026`,
  ].join("\n");
  const table = toTable(parseCsv(csv));
  const privacyMap = toMapping(autoMap(table.headers, { privacy: true }));

  it("maps the tabel number to the code (not external_ref) and offers no name fields", () => {
    expect(privacyMap).toEqual({ 0: "employee_code", 1: null, 2: "start_date" });
    expect(toMapping(autoMap(table.headers))).toEqual({ 0: "external_ref", 1: "full_name", 2: "start_date" });
  });
  it.each([
    ["Employee code", "employee_code"], ["Code", "employee_code"], ["Tab. No", "employee_code"], ["Աշխատակցի կոդ", "employee_code"],
    ["Կոդ", "employee_code"], ["Код", "employee_code"], ["Таб. №", "employee_code"], ["Табельный номер", "employee_code"], ["Tabel number", "employee_code"],
  ])("privacy: header %s maps to the code", (h, f) => expect(autoMap([h], { privacy: true })[0].field).toBe(f));
  it("outside privacy mode a Code header never maps to employee_code", () => {
    expect(autoMap(["Code"])[0].field).toBeNull();
    expect(autoMap(["Employee code"]).map((g) => g.field)).not.toContain("employee_code");
  });
  it("does not require a code (missing codes are generated), only the start date", () => {
    expect(missingRequiredFields({ 0: "start_date" }, { privacy: true })).toEqual([]);
    expect(missingRequiredFields({ 1: "full_name" }, { privacy: true })).toEqual(["start_date"]);
    expect(missingRequiredFields({ 0: "employee_code", 1: "start_date" }, { privacy: true })).toEqual([]);
    expect(missingRequiredFields({ 0: "employee_code", 1: "start_date" })).toEqual(["full_name"]);
  });
  it("stores full_name = code, ignores names in the file, generates missing codes, reports long / repeated codes", () => {
    const r = buildImport(table, { 0: "employee_code", 1: "full_name", 2: "start_date" }, { orgId: "o", companyId: "c", privacy: true });
    // row 5 has no code: it gets the first free one (EMP-001 and EMP-002 are taken by the file)
    expect(r.employees.map((e) => [e.full_name, e.employee_code])).toEqual([["EMP-001", "EMP-001"], ["EMP-002", "EMP-002"], ["EMP-003", "EMP-003"]]);
    expect(JSON.stringify(r.employees)).not.toMatch(/Иван|Другой|Без кода/);
    expect(r.errors.map((e) => [e.row, e.field, e.key])).toEqual([
      [4, "employee_code", "import.error.duplicateCode"],
      [6, "employee_code", "import.error.tooLong"],
    ]);
  });
  it("generated codes skip codes already in the company and ones typed further down the file", () => {
    const t = toTable(parseCsv(["Code;Start", ";15.01.2026", "EMP-002;16.01.2026", ";17.01.2026"].join("\n")));
    const r = buildImport(t, { 0: "employee_code", 1: "start_date" }, { orgId: "o", companyId: "c", privacy: true, existingCodes: ["emp-001"] });
    expect(r.errors).toEqual([]);
    expect(r.employees.map((e) => e.employee_code)).toEqual(["EMP-003", "EMP-002", "EMP-004"]);
  });
  it("generated-code rows are flagged so re-imports can match them by employee ID", () => {
    const t = toTable(parseCsv(["ID;Start", "A1;15.01.2026", "A2;16.01.2026"].join("\n")));
    const r = buildImport(t, { 0: "external_ref", 1: "start_date" }, { orgId: "o", companyId: "c", privacy: true });
    expect(r.generatedCodeIds).toEqual(r.employees.map((e) => e.id));
  });
  it("works with no code column at all", () => {
    const t = toTable(parseCsv(["Start;Name", "15.01.2026;Anna", "16.01.2026;Boris"].join("\n")));
    const r = buildImport(t, { 0: "start_date", 1: "full_name" }, { orgId: "o", companyId: "c", privacy: true });
    expect(r.employees.map((e) => [e.full_name, e.employee_code])).toEqual([["EMP-001", "EMP-001"], ["EMP-002", "EMP-002"]]);
  });
  it("outside privacy mode the code column is ignored and no employee_code key is written", () => {
    const r = buildImport(table, { 0: "employee_code", 1: "full_name", 2: "start_date" }, { orgId: "o", companyId: "c" });
    expect(r.employees[0]).not.toHaveProperty("employee_code");
    expect(r.employees[0].full_name).toBe("Иван Иванов");
  });
});

describe("import sanity warnings", () => {
  const table = toTable([
    ["Full name", "Hire date", "Date of birth", "Contract end", "Probation end"],
    ["Anna", "01.02.2026", "10.05.1990", "", ""],
    ["Child", "01.02.2026", "01.01.2020", "", ""],
    ["Future", "01.03.2029", "10.05.1990", "", ""],
  ]);
  it("warns but still imports the row", () => {
    const mapping = toMapping(autoMap(table.headers));
    const r = buildImport(table, mapping, { ...opts(), today: "2026-11-22" });
    expect(r.errors).toEqual([]);
    expect(r.employees).toHaveLength(3);
    expect(r.warnings.map((w) => [w.row, w.key])).toEqual([[3, "tooYoung"], [4, "futureStart"]]);
  });
});
