import { describe, expect, it } from "vitest";
import { currentStreak, earnedBadges } from "../../../../lib/quiz/quiz";
import { buildWeekRecords, parseWeekKey, wasCleanAt, weekEnd, weekKey, type FindingHistoryRow } from "./streak";

const f = (o: Partial<FindingHistoryRow> = {}): FindingHistoryRow => ({
  severity: "advisory", due_date: "2026-11-10", first_seen_at: "2026-11-01T01:00:00Z", resolved_at: null, ...o,
});

describe("week keys", () => {
  it("round-trips and zero-pads", () => {
    expect(weekKey({ year: 2026, week: 3 })).toBe("2026-W03");
    expect(parseWeekKey("2026-W03")).toEqual({ year: 2026, week: 3 });
    expect(parseWeekKey("2026-3")).toBeNull();
  });
  it("finds the Sunday of a week, including week 53 and year boundaries", () => {
    expect(weekEnd({ year: 2026, week: 47 })).toBe("2026-11-22");
    expect(weekEnd({ year: 2026, week: 53 })).toBe("2027-01-03");
    expect(weekEnd({ year: 2027, week: 1 })).toBe("2027-01-10");
  });
});

describe("wasCleanAt", () => {
  it("dirty when an open advisory/red finding is overdue", () => {
    expect(wasCleanAt([f()], "2026-11-15")).toBe(false);
    expect(wasCleanAt([f({ severity: "red" })], "2026-11-15")).toBe(false);
  });
  it("clean when not yet due, or due the same day", () => {
    expect(wasCleanAt([f()], "2026-11-10")).toBe(true);
  });
  it("ignores amber and info", () => {
    expect(wasCleanAt([f({ severity: "amber" }), f({ severity: "info" })], "2026-11-15")).toBe(true);
  });
  it("clean once resolved before the date; dirty if resolved after it", () => {
    expect(wasCleanAt([f({ resolved_at: "2026-11-12T09:00:00Z" })], "2026-11-15")).toBe(true);
    expect(wasCleanAt([f({ resolved_at: "2026-11-20T09:00:00Z" })], "2026-11-15")).toBe(false);
  });
  it("ignores findings first seen after the date", () => {
    expect(wasCleanAt([f({ first_seen_at: "2026-11-16T00:00:00Z" })], "2026-11-15")).toBe(true);
  });
});

describe("buildWeekRecords", () => {
  it("builds a 2-week streak across clean weeks with attempts", () => {
    const records = buildWeekRecords([{ iso_week: "2026-W46", score: 80 }, { iso_week: "2026-W47", score: 100 }], [], "2026-11-18");
    expect(records).toHaveLength(2);
    expect(currentStreak(records, { year: 2026, week: 47 })).toBe(2);
    expect(earnedBadges(records)).toEqual(["first_clean_week", "quiz_ace"]);
  });
  it("judges the current week as of today, not its future Sunday", () => {
    // Due 2026-11-20: not overdue on Wed 18th even though it would be by Sunday 22nd.
    const records = buildWeekRecords([{ iso_week: "2026-W47", score: 60 }], [f({ due_date: "2026-11-20" })], "2026-11-18");
    expect(records[0].clean).toBe(true);
  });
  it("a dirty week breaks the streak", () => {
    const findings = [f({ due_date: "2026-11-12", resolved_at: "2026-11-17T08:00:00Z" })];
    const records = buildWeekRecords([{ iso_week: "2026-W46", score: 80 }, { iso_week: "2026-W47", score: 80 }], findings, "2026-11-18");
    expect(records.map((r) => r.clean)).toEqual([false, true]);
    expect(currentStreak(records, { year: 2026, week: 47 })).toBe(1);
  });
  it("skips malformed week keys", () => {
    expect(buildWeekRecords([{ iso_week: "bad", score: 1 }], [], "2026-11-18")).toEqual([]);
  });
});
