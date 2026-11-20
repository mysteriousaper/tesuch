import { describe, expect, it } from "vitest";
import { inspectionReadyScore } from "../../lib/rules/score";
import { buildOverview, statsFor, type StatRow } from "./stats";

describe("company stats", () => {
  it("counts beyond 1000 rows (grouped counts, no row cap)", () => {
    const rows: StatRow[] = [
      { company_id: "a", kind: "staff", overdue: false, n: "1170" },
      { company_id: "a", kind: "info", overdue: false, n: 1500 },
      { company_id: "a", kind: "amber", overdue: false, n: 1 },
    ];
    expect(statsFor(rows, "a")).toEqual({ score: 92, open: 1501, staff: 1170 });
  });
  it("matches inspectionReadyScore", () => {
    const fs = [{ severity: "red" as const, overdue: true }, { severity: "amber" as const, overdue: false }, { severity: "advisory" as const, overdue: false }];
    const rows: StatRow[] = [
      { company_id: "a", kind: "red", overdue: true, n: 1 },
      { company_id: "a", kind: "amber", overdue: false, n: 1 },
      { company_id: "a", kind: "advisory", overdue: false, n: 1 },
    ];
    expect(statsFor([{ company_id: "a", kind: "staff", overdue: false, n: 1 }, ...rows], "a").score).toBe(inspectionReadyScore(fs));
  });
  it("sorts riskiest first and averages the firm", () => {
    const o = buildOverview(
      [{ id: "a", name: "A" }, { id: "b", name: "B" }],
      [{ company_id: "a", kind: "staff", overdue: false, n: 3 }, { company_id: "b", kind: "staff", overdue: false, n: 3 }, { company_id: "b", kind: "red", overdue: true, n: 2 }],
    );
    expect(o.rows.map((r) => r.id)).toEqual(["b", "a"]);
    expect(o.firm).toBe(60);
  });
  it("a company with 0 staff has score null and is left out of the firm average", () => {
    const o = buildOverview(
      [{ id: "a", name: "A" }, { id: "z", name: "Z" }],
      [{ company_id: "a", kind: "staff", overdue: false, n: 2 }, { company_id: "a", kind: "red", overdue: false, n: 1 }],
    );
    expect(o.rows.find((r) => r.id === "z")).toMatchObject({ score: null, staff: 0, open: 0 });
    expect(o.rows.map((r) => r.id)).toEqual(["a", "z"]);
    expect(o.firm).toBe(80);
    expect(buildOverview([{ id: "z", name: "Z" }], []).firm).toBeNull();
  });
  it("an open advisory finding caps below a perfect score; info alone stays 100", () => {
    const staff: StatRow = { company_id: "a", kind: "staff", overdue: false, n: 5 };
    expect(statsFor([staff, { company_id: "a", kind: "advisory", overdue: false, n: 1 }], "a").score).toBeLessThanOrEqual(99);
    expect(statsFor([staff, { company_id: "a", kind: "info", overdue: false, n: 4 }], "a")).toEqual({ score: 100, open: 4, staff: 5 });
  });
});
