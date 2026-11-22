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
