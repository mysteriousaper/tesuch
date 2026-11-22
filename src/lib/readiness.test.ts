import { describe, expect, it } from "vitest";
import { MAX_TASKS, pickTasks, readinessStatus, type TaskCandidate } from "./readiness";

describe("readinessStatus thresholds", () => {
  it("no staff means no status", () => {
    expect(readinessStatus({ score: null, staff: 0, overdueScoring: 0 })).toBe("none");
    expect(readinessStatus({ score: 100, staff: 0, overdueScoring: 0 })).toBe("none");
  });
  it.each([
    [100, "clear"], [90, "clear"], [89, "attention"], [60, "attention"], [59, "risk"], [0, "risk"],
  ] as const)("score %i is %s", (score, expected) => {
    expect(readinessStatus({ score, staff: 5, overdueScoring: 0 })).toBe(expected);
  });
  it("an overdue issue keeps a high score from being clear", () => {
    expect(readinessStatus({ score: 92, staff: 5, overdueScoring: 1 })).toBe("attention");
  });
  it("an overdue issue never softens Risk", () => {
    expect(readinessStatus({ score: 40, staff: 5, overdueScoring: 3 })).toBe("risk");
  });
});

const t = (o: Partial<TaskCandidate>): TaskCandidate => ({ ruleId: "r", severity: "advisory", dueDate: "2026-12-01", overdue: false, employeeId: "e1", ...o });

describe("pickTasks", () => {
  it("never returns more than three", () => {
    const many = Array.from({ length: 8 }, (_, i) => t({ ruleId: `r${i}` }));
    expect(pickTasks(many)).toHaveLength(MAX_TASKS);
  });
  it("orders overdue first, then severity, then due date", () => {
    const out = pickTasks([
      t({ ruleId: "late-advisory", dueDate: "2026-12-20" }),
      t({ ruleId: "soon-red", severity: "red", dueDate: "2026-12-02" }),
      t({ ruleId: "overdue-advisory", overdue: true, dueDate: "2026-10-01" }),
      t({ ruleId: "soon-amber", severity: "amber", dueDate: "2026-12-05" }),
    ]);
    expect(out.map((x) => x.ruleId)).toEqual(["overdue-advisory", "soon-red", "soon-amber"]);
  });
  it("skips info items and lists a rule once per employee", () => {
    const out = pickTasks([t({ severity: "info", ruleId: "i" }), t({ ruleId: "a" }), t({ ruleId: "a", dueDate: "2027-01-01" }), t({ ruleId: "a", employeeId: "e2" })]);
    expect(out.map((x) => [x.ruleId, x.employeeId])).toEqual([["a", "e1"], ["a", "e2"]]);
  });
  it("returns nothing when there is nothing to do", () => {
    expect(pickTasks([])).toEqual([]);
  });
});
