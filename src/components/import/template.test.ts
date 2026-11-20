import { describe, expect, it } from "vitest";
import en from "../../../messages/en/import.json";
import hy from "../../../messages/hy/import.json";
import ru from "../../../messages/ru/import.json";
import { autoMap, buildImport, parseCsv, toMapping, toTable, type TargetField } from "../../lib/import";
import { TEMPLATE_FIELDS, templateCsv } from "./template";

const MESSAGES = { hy, ru, en };

describe("import template", () => {
  for (const locale of ["hy", "ru", "en"] as const) {
    const m = MESSAGES[locale].import;
    const csv = templateCsv(locale, (f) => (m.fields as Record<TargetField, string>)[f], { name: m.templateSample.name, ground: m.templateSample.ground });

    it(`${locale}: every template header is auto-mapped to its own field`, () => {
      const table = toTable(parseCsv(csv));
      const guesses = autoMap(table.headers);
      expect(guesses.map((g) => g.field)).toEqual(TEMPLATE_FIELDS);
      expect(guesses.every((g) => g.confidence === 1)).toBe(true);
    });

    it(`${locale}: the privacy template has a code and no names, maps cleanly and imports`, () => {
      const pcsv = templateCsv(locale, (f) => (m.fields as Record<TargetField, string>)[f], { name: m.templateSample.name, ground: m.templateSample.ground }, { privacy: true });
      const table = toTable(parseCsv(pcsv));
      const map = toMapping(autoMap(table.headers, { privacy: true }));
      expect(Object.values(map)).toContain("employee_code");
      expect(Object.values(map)).not.toContain("full_name");
      expect(Object.values(map)).not.toContain("external_ref");
      expect(Object.values(map).every(Boolean)).toBe(true);
      const result = buildImport(table, map, { orgId: "o", companyId: "c", privacy: true });
      expect(result.errors).toEqual([]);
      expect(result.employees[0]).toMatchObject({ full_name: "EMP-014", employee_code: "EMP-014" });
    });

    it(`${locale}: the sample row imports without errors`, () => {
      const table = toTable(parseCsv(csv));
      const result = buildImport(table, toMapping(autoMap(table.headers)), { orgId: "o", companyId: "c" });
      expect(result.errors).toEqual([]);
      expect(result.employees).toHaveLength(1);
      expect(result.contracts[0]).toMatchObject({ type: "fixed_term", start_date: "2026-01-15", end_date: "2027-01-14", src_registered: true });
    });
  }

  it("starts with a UTF-8 BOM for Excel", () => {
    expect(templateCsv("hy", (f) => f, { name: "x", ground: "y" }).charCodeAt(0)).toBe(0xfeff);
  });
});
