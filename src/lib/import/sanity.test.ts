import { describe, expect, it } from "vitest";
import { daysSince, isStale, sanityIssues } from "./sanity";

const TODAY = "2026-11-22";
const keys = (i: Parameters<typeof sanityIssues>[0]) => sanityIssues(i, TODAY).map((x) => x.key);

describe("sanityIssues", () => {
  it("accepts ordinary data", () => {
    expect(keys({ birthDate: "1990-05-10", startDate: "2026-01-15", endDate: "2027-01-14", probationEnd: "2026-04-15", leaveDays: 20 })).toEqual([]);
  });
  it("start date more than a year ahead", () => {
    expect(keys({ startDate: "2027-11-22" })).toEqual([]); // exactly one year: fine
    expect(keys({ startDate: "2027-11-23" })).toEqual(["futureStart"]);
  });
  it("age under 14 or over 100, counted in full years", () => {
    expect(keys({ birthDate: "2012-11-22" })).toEqual([]); // turns 14 today
    expect(keys({ birthDate: "2012-11-23" })).toEqual(["tooYoung"]);
    expect(keys({ birthDate: "1925-11-23" })).toEqual([]); // still 100
    expect(keys({ birthDate: "1925-11-22" })).toEqual(["tooOld"]); // turns 101 today
  });
  it("end or probation end before start", () => {
    expect(keys({ startDate: "2026-05-01", endDate: "2026-04-30" })).toEqual(["endBeforeStart"]);
    expect(keys({ startDate: "2026-05-01", probationEnd: "2026-04-30" })).toEqual(["probationBeforeStart"]);
    expect(keys({ startDate: "2026-05-01", endDate: "2026-05-01", probationEnd: "2026-05-01" })).toEqual([]);
  });
  it("leave days over 400", () => {
    expect(keys({ leaveDays: 400 })).toEqual([]);
    expect(keys({ leaveDays: 401 })).toEqual(["leaveDays"]);
  });
  it("ignores missing or unparsable dates", () => {
    expect(keys({ birthDate: "", startDate: "garbage", endDate: null })).toEqual([]);
  });
});

describe("data age", () => {
  it("counts whole days and nudges after 90", () => {
    expect(daysSince("2026-11-12T08:00:00Z", TODAY)).toBe(10);
    expect(daysSince(null, TODAY)).toBeNull();
    expect(isStale("2026-08-24", TODAY)).toBe(false); // 90 days
    expect(isStale("2026-08-23", TODAY)).toBe(true); // 91 days
    expect(isStale(null, TODAY)).toBe(false);
  });
});
