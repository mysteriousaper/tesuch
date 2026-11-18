import { describe, expect, it } from "vitest";
import { LOCALES } from "../notify/i18n";
import { RULES } from "../rules/catalog";
import { QUESTIONS } from "./questions";
import {
  currentStreak, earnedBadges, isCleanWeek, isoWeekOf, longestStreak, nextWeek, pickWeeklyQuestions,
  scoreQuiz, weekIndex, type IsoWeek, type WeekRecord,
} from "./quiz";

const ruleIds = new Set(RULES.map((r) => r.id));
const ARMENIAN = /[Ա-և]/;

describe("question bank", () => {
  it("has about 20 questions with unique ids", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
  });
  it.each(QUESTIONS.map((q) => [q.id, q] as const))("%s is grounded in a rule and fully translated", (_id, q) => {
    expect(ruleIds.has(q.ruleId)).toBe(true);
    expect(q.options.length).toBeGreaterThanOrEqual(3);
    expect(q.correct).toBeGreaterThanOrEqual(0);
    expect(q.correct).toBeLessThan(q.options.length);
    for (const l of LOCALES) {
      expect(q.prompt[l].trim()).not.toBe("");
      expect(q.explanation[l].trim()).not.toBe("");
      for (const o of q.options) expect(o[l].trim()).not.toBe("");
      expect(new Set(q.options.map((o) => o[l])).size).toBe(q.options.length);
    }
    expect(q.prompt.hy).toMatch(ARMENIAN);
    expect(q.prompt.hy).toMatch(/[՞։]/); // Armenian question/full-stop marks, not Latin "?"
    expect(q.prompt.hy).not.toContain("?");
  });
  it("covers most rules", () => {
    expect(new Set(QUESTIONS.map((q) => q.ruleId)).size).toBeGreaterThanOrEqual(10);
  });
  it("does not always put the right answer in the same slot", () => {
    expect(new Set(QUESTIONS.map((q) => q.correct)).size).toBe(3);
  });
});

describe("weekly pick", () => {
  const w: IsoWeek = { year: 2026, week: 47 };
  it("is deterministic per company and week", () => {
    expect(pickWeeklyQuestions("co1", w).map((q) => q.id)).toEqual(pickWeeklyQuestions("co1", w).map((q) => q.id));
  });
  it("varies by week and by company", () => {
    const a = pickWeeklyQuestions("co1", w).map((q) => q.id).join();
    expect(pickWeeklyQuestions("co1", { year: 2026, week: 48 }).map((q) => q.id).join()).not.toBe(a);
    expect(pickWeeklyQuestions("co2", w).map((q) => q.id).join()).not.toBe(a);
  });
  it("returns 5 distinct questions with rule status and article attached", () => {
    const qs = pickWeeklyQuestions("co1", w);
    expect(qs).toHaveLength(5);
    expect(new Set(qs.map((q) => q.id)).size).toBe(5);
    for (const q of qs) {
      const rule = RULES.find((r) => r.id === q.ruleId)!;
      expect(q.ruleStatus).toBe(rule.status);
      expect(q.article).toBe(rule.article);
    }
  });
});

describe("scoring", () => {
  it("counts correct answers and treats blanks as wrong", () => {
    const qs = QUESTIONS.slice(0, 4);
    const r = scoreQuiz(qs, [qs[0].correct, (qs[1].correct + 1) % 3, null]);
    expect(r).toMatchObject({ correct: 1, total: 4, percent: 25 });
    expect(r.answers[2]).toMatchObject({ chosen: null, correct: false });
  });
  it("handles an empty quiz", () => expect(scoreQuiz([], []).percent).toBe(0));
});

describe("ISO weeks across year boundaries", () => {
  it("2026 has 53 ISO weeks: W53 → 2027-W01", () => {
    expect(isoWeekOf("2026-12-31")).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf("2027-01-03")).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf("2027-01-04")).toEqual({ year: 2027, week: 1 });
    expect(nextWeek({ year: 2026, week: 53 })).toEqual({ year: 2027, week: 1 });
    expect(weekIndex({ year: 2027, week: 1 }) - weekIndex({ year: 2026, week: 53 })).toBe(1);
  });
  it("2027 has 52: W52 → 2028-W01", () => {
    expect(nextWeek({ year: 2027, week: 52 })).toEqual({ year: 2028, week: 1 });
    expect(weekIndex({ year: 2028, week: 1 }) - weekIndex({ year: 2027, week: 52 })).toBe(1);
  });
  it("early-January dates can belong to the previous ISO year", () => {
    expect(isoWeekOf("2021-01-01")).toEqual({ year: 2020, week: 53 });
  });
});

describe("streaks and badges", () => {
  const rec = (year: number, week: number, o: Partial<WeekRecord> = {}): WeekRecord => ({ year, week, clean: true, quizTaken: true, ...o });

  it("clean week ignores fixed, non-overdue, amber and info findings", () => {
    expect(isCleanWeek([
      { status: "fixed", severity: "red", overdue: true },
      { status: "open", severity: "red", overdue: false },
      { status: "open", severity: "amber", overdue: true },
      { status: "open", severity: "info", overdue: true },
    ])).toBe(true);
    expect(isCleanWeek([{ status: "open", severity: "advisory", overdue: true }])).toBe(false);
    expect(isCleanWeek([{ status: "open", severity: "red", overdue: true }])).toBe(false);
  });

  it("counts a streak across 2026-W53 into 2027", () => {
    const records = [rec(2026, 51), rec(2026, 52), rec(2026, 53), rec(2027, 1), rec(2027, 2)];
    expect(currentStreak(records, { year: 2027, week: 2 })).toBe(5);
  });
  it("skipping W53 breaks the streak", () => {
    const records = [rec(2026, 51), rec(2026, 52), rec(2027, 1), rec(2027, 2)];
    expect(currentStreak(records, { year: 2027, week: 2 })).toBe(2);
    expect(longestStreak(records)).toBe(2);
  });
  it("counts across 2027-W52 into 2028-W01", () => {
    expect(currentStreak([rec(2027, 51), rec(2027, 52), rec(2028, 1)], { year: 2028, week: 1 })).toBe(3);
  });
  it("an unfinished current week does not break the streak, an older gap does", () => {
    const records = [rec(2026, 45), rec(2026, 46)];
    expect(currentStreak(records, { year: 2026, week: 47 })).toBe(2);
    expect(currentStreak(records, { year: 2026, week: 48 })).toBe(0);
  });
  it("needs both a clean week and the quiz", () => {
    const records = [rec(2026, 44), rec(2026, 45, { quizTaken: false }), rec(2026, 46), rec(2026, 47, { clean: false })];
    expect(longestStreak(records)).toBe(1);
  });
  it("ignores duplicate records for the same week", () => {
    expect(longestStreak([rec(2026, 10), rec(2026, 10), rec(2026, 11)])).toBe(2);
  });
  it("awards badges, and keeps them after a streak breaks", () => {
    expect(earnedBadges([])).toEqual([]);
    expect(earnedBadges([rec(2026, 1, { quizTaken: false })])).toEqual(["first_clean_week"]);
    const twelve = Array.from({ length: 12 }, (_, i) => rec(2026, 10 + i));
    expect(earnedBadges([...twelve, rec(2026, 30, { quizPercent: 100 })])).toEqual(["first_clean_week", "streak_4", "streak_12", "quiz_ace"]);
    expect(earnedBadges(twelve.slice(0, 4))).toContain("streak_4");
  });
});
