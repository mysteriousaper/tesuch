import type { EffectiveSeverity, Finding } from "./types";

/** Points deducted per open finding. Overdue findings count double. Product choice, see docs/DECISIONS.md. */
export const PENALTY: Record<EffectiveSeverity, number> = { red: 20, amber: 8, advisory: 4, info: 0 };

/** Highest score while any red/amber/advisory finding is open: never a perfect score with open issues. */
export const OPEN_ISSUE_CAP = 99;

/** Score from a total penalty and whether any scoring (non-info) finding is open. */
export function scoreFrom(penalty: number, hasOpenIssue: boolean): number {
  const raw = Math.max(0, 100 - penalty);
  return hasOpenIssue ? Math.min(OPEN_ISSUE_CAP, raw) : raw;
}

/** Inspection-Ready Score, 0–100. Callers pass null instead of calling this for a company with no staff. */
export function inspectionReadyScore(findings: Pick<Finding, "severity" | "overdue">[]): number {
  const penalty = findings.reduce((sum, f) => sum + PENALTY[f.severity] * (f.overdue ? 2 : 1), 0);
  return scoreFrom(penalty, findings.some((f) => f.severity !== "info"));
}

/** Firm score: mean of company scores, so one large company cannot hide the rest. Companies without data (null) are skipped. */
export function firmScore(companyScores: (number | null)[]): number | null {
  const scored = companyScores.filter((s): s is number => s !== null);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
}
