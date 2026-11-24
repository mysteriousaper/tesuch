import { describe, expect, it } from "vitest";
import { RULES } from "./catalog";
import { CHECKLIST, checklistCoverage, checklistCoverageLine, DOCUMENT_ITEMS, documentGroups, isDocumentQuestionNo } from "./checklist";

describe("checklist N 5.1 data", () => {
  it("holds the 102 scored questions with weights summing to 50", () => {
    expect(CHECKLIST.questions).toHaveLength(102);
    expect(CHECKLIST.questions.reduce((n, q) => n + q.weight, 0)).toBeCloseTo(CHECKLIST.total_weight, 5);
    expect(new Set(CHECKLIST.questions.map((q) => q.no)).size).toBe(102);
  });
  it("covered_by names only rules that exist, and every question has text and a known group in hy/ru/en", () => {
    const ids = new Set(RULES.map((r) => r.id));
    for (const q of CHECKLIST.questions) {
      if (q.covered_by !== "document") for (const id of q.covered_by) expect(ids.has(id), `${q.no}: ${id}`).toBe(true);
      expect(CHECKLIST.groups[q.group], q.no).toBeDefined();
      for (const l of ["hy", "ru", "en"] as const) expect(q.text[l].length, `${q.no} ${l}`).toBeGreaterThan(5);
    }
  });
  it("computes coverage from the data: items with a rule vs. documents", () => {
    const { checked, total } = checklistCoverage();
    expect(total).toBe(102);
    expect(checked + DOCUMENT_ITEMS.length).toBe(102);
    expect(checked).toBe(12);
  });
  it("lists the document items grouped, and only they can be ticked", () => {
    expect(documentGroups().flatMap((g) => g.items)).toEqual(DOCUMENT_ITEMS);
    expect(isDocumentQuestionNo("6.1")).toBe(true);
    expect(isDocumentQuestionNo("1")).toBe(false); // checked by employee-no-contract
    expect(isDocumentQuestionNo("999")).toBe(false);
  });
  it("coverage line carries both numbers in every language", () => {
    for (const l of ["hy", "ru", "en"] as const) {
      const line = checklistCoverageLine(l);
      expect(line).toContain("102");
      expect(line).toContain("12");
    }
  });
});
