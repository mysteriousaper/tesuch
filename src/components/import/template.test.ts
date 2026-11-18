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
