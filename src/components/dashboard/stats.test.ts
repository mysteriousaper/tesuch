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
    expect(statsFor(rows, "a").score).toBe(inspectionReadyScore(fs));
  });
  it("sorts riskiest first and averages the firm", () => {
    const o = buildOverview([{ id: "a", name: "A" }, { id: "b", name: "B" }], [{ company_id: "b", kind: "red", overdue: true, n: 2 }]);
    expect(o.rows.map((r) => r.id)).toEqual(["b", "a"]);
    expect(o.firm).toBe(Math.round((20 + 100) / 2));
  });
});
