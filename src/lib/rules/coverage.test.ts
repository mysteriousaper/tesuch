import { describe, expect, it } from "vitest";
import { coverageLine } from "../notify/i18n";
import { RULES } from "./catalog";
import { coverage } from "./coverage";

describe("coverage", () => {
  it("counts and titles come from the rule files", () => {
    for (const l of ["hy", "ru", "en"] as const) {
      const c = coverage(l);
      expect(c.count).toBe(RULES.length);
      expect(c.titles).toEqual(RULES.map((r) => r.title[l]));
    }
  });
  it("the one-line note names the real count and is not a guarantee, in every language", () => {
    expect(coverageLine("en")).toBe(`Tesuch checks ${RULES.length} areas. Not a guarantee of the inspection result.`);
    expect(coverageLine("ru")).toContain(String(RULES.length));
    expect(coverageLine("hy")).toContain(String(RULES.length));
  });
});

import { rulesReviewedLine } from "../notify/i18n";
import { rulesReviewedOn } from "./coverage";

describe("rules last reviewed", () => {
  it("every rule file has the field, null until a lawyer reviews it", () => {
    for (const r of RULES) expect(r.reviewed_on).toBeNull();
    expect(rulesReviewedOn()).toBeNull();
    expect(rulesReviewedLine("en")).toBe("Rules not yet reviewed by a lawyer");
  });
  it("uses the oldest review date, and null if any rule was never reviewed", () => {
    expect(rulesReviewedOn([{ reviewed_on: "2026-11-01" }, { reviewed_on: "2026-09-15" }])).toBe("2026-09-15");
    expect(rulesReviewedOn([{ reviewed_on: "2026-11-01" }, { reviewed_on: null }])).toBeNull();
    expect(rulesReviewedOn([])).toBeNull();
  });
});
