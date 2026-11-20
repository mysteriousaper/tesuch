import { describe, expect, it } from "vitest";
import { findingsHref, groupByRule, likePattern, pageCount, pageRange, parseFindingParams } from "./finding-query";

describe("parseFindingParams", () => {
  it("accepts known values", () => {
    expect(parseFindingParams({ sev: "red", q: "  Anna ", page: "3" })).toEqual({ sev: "red", q: "Anna", page: 3 });
  });
  it("ignores unknown severity and bad pages", () => {
    expect(parseFindingParams({ sev: "drop table", page: "-5" })).toEqual({ sev: null, q: "", page: 1 });
    expect(parseFindingParams({ page: "abc" }).page).toBe(1);
    expect(parseFindingParams({ page: "99999999" }).page).toBe(1);
    expect(parseFindingParams({ sev: ["amber", "red"] }).sev).toBe("amber");
  });
  it("caps the search text", () => {
    expect(parseFindingParams({ q: "x".repeat(500) }).q).toHaveLength(60);
  });
});

describe("likePattern", () => {
  it("wraps plain text", () => expect(likePattern("Anna")).toBe("%Anna%"));
  it("strips wildcards and filter separators", () => {
    expect(likePattern("a%b_c\\d,e(f)g*")).toBe("%a b c d e f g%");
    expect(likePattern("%%__")).toBeNull();
    expect(likePattern("   ")).toBeNull();
  });
});

describe("paging", () => {
  it("ranges", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 49 });
    expect(pageRange(3)).toEqual({ from: 100, to: 149 });
  });
  it("counts pages", () => {
    expect([pageCount(0), pageCount(50), pageCount(51), pageCount(1000)]).toEqual([1, 1, 2, 20]);
  });
});

describe("findingsHref / groupByRule", () => {
  it("builds links without empty values", () => {
    expect(findingsHref({})).toBe("?");
    expect(findingsHref({ sev: "red", q: "an", page: 2 })).toBe("?sev=red&q=an&page=2");
    expect(findingsHref({ page: 1 })).toBe("?");
  });
  it("groups by rule in first-seen order", () => {
    const g = groupByRule([{ rule_id: "a", n: 1 }, { rule_id: "b", n: 2 }, { rule_id: "a", n: 3 }]);
    expect(g.map((x) => [x.ruleId, x.items.map((i) => i.n)])).toEqual([["a", [1, 3]], ["b", [2]]]);
  });
});
