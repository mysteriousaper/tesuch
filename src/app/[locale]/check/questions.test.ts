import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RULES } from "../../../lib/rules/catalog";
import { band, CHECK_QUESTIONS, scoreAnswers, verdict, type Answer } from "./questions";

const all = (a: Answer) => Object.fromEntries(CHECK_QUESTIONS.map((q) => [q.id, a]));
const allGood = Object.fromEntries(CHECK_QUESTIONS.map((q) => [q.id, q.good]));
const allBad = Object.fromEntries(CHECK_QUESTIONS.map((q) => [q.id, q.good === "yes" ? "no" : "yes"])) as Record<string, Answer>;

describe("self-check questions", () => {
  it("has 10 questions, each tied to a real rule, no duplicates", () => {
    expect(CHECK_QUESTIONS).toHaveLength(10);
    expect(new Set(CHECK_QUESTIONS.map((q) => q.id)).size).toBe(10);
    for (const q of CHECK_QUESTIONS) expect(RULES.map((r) => r.id)).toContain(q.id);
  });

  it("has question and explanation text for every question in hy, ru and en", () => {
    for (const locale of ["hy", "ru", "en"]) {
      const msgs = JSON.parse(readFileSync(`messages/${locale}/check.json`, "utf8")).check.questions;
      for (const q of CHECK_QUESTIONS) {
        expect(msgs[q.id]?.q, `${locale}:${q.id}.q`).toBeTruthy();
        expect(msgs[q.id]?.why, `${locale}:${q.id}.why`).toBeTruthy();
      }
    }
  });
});

describe("scoring", () => {
  it("all compliant = 100, all non-compliant = 0", () => {
    expect(scoreAnswers(allGood)).toBe(100);
    expect(scoreAnswers(allBad)).toBe(0);
  });
  it("all unsure = 30", () => {
    expect(scoreAnswers(all("unsure"))).toBe(30);
  });
  it("unanswered counts as non-compliant", () => {
    expect(scoreAnswers({})).toBe(0);
    expect(verdict(CHECK_QUESTIONS[0], undefined)).toBe("bad");
  });
  it("respects questions where 'no' is the compliant answer", () => {
    const minor = CHECK_QUESTIONS.find((q) => q.id === "probation-minor")!;
    expect(verdict(minor, "no")).toBe("good");
    expect(verdict(minor, "yes")).toBe("bad");
  });
  it("one miss out of ten = 90", () => {
    expect(scoreAnswers({ ...allGood, [CHECK_QUESTIONS[2].id]: allBad[CHECK_QUESTIONS[2].id] })).toBe(90);
  });
  it("bands at 80 and 50", () => {
    expect([band(100), band(80), band(79), band(50), band(49), band(0)]).toEqual(["good", "good", "mid", "mid", "low", "low"]);
  });
});
