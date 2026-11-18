// The free self-check. Each question maps 1:1 to a rule in rules/*.json (id = rule id), so the
// explanation, article and source shown with the result always come from the versioned rule.

export type Answer = "yes" | "no" | "unsure";

export interface CheckQuestion {
  /** Rule id in rules/*.json. Also the translation key under check.questions. */
  id: string;
  /** The answer that means "compliant". */
  good: Exclude<Answer, "unsure">;
}

export const CHECK_QUESTIONS: CheckQuestion[] = [
  { id: "probation-minor", good: "no" },
  { id: "probation-transfer", good: "no" },
  { id: "probation-max", good: "yes" },
  { id: "probation-ending", good: "yes" },
  { id: "fixed-term-ground", good: "yes" },
  { id: "fixed-term-ending", good: "yes" },
  { id: "termination-ground", good: "yes" },
  { id: "annual-leave-min", good: "yes" },
  { id: "leave-cash-swap", good: "no" },
  { id: "notice-period", good: "yes" },
];

/** Points per answer: compliant 10, unsure 3 (unknown is still a risk), non-compliant 0. */
export const POINTS = { good: 10, unsure: 3, bad: 0 } as const;

export function verdict(q: CheckQuestion, a: Answer | undefined): "good" | "unsure" | "bad" {
  if (a === undefined) return "bad";
  if (a === "unsure") return "unsure";
  return a === q.good ? "good" : "bad";
}

/** 0–100. Unanswered questions count as non-compliant. */
export function scoreAnswers(answers: Partial<Record<string, Answer>>, questions: CheckQuestion[] = CHECK_QUESTIONS): number {
  if (questions.length === 0) return 0;
  const total = questions.reduce((sum, q) => sum + POINTS[verdict(q, answers[q.id])], 0);
  return Math.round((total / (questions.length * POINTS.good)) * 100);
}

export function band(score: number): "good" | "mid" | "low" {
  return score >= 80 ? "good" : score >= 50 ? "mid" : "low";
}
