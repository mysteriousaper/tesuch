import type { EffectiveSeverity, Finding } from "./types";

/** Points deducted per open finding. Overdue findings count double. Product choice, see docs/DECISIONS.md. */
export const PENALTY: Record<EffectiveSeverity, number> = { red: 20, amber: 8, advisory: 4, info: 0 };

/** Inspection-Ready Score, 0–100. */
export function inspectionReadyScore(findings: Pick<Finding, "severity" | "overdue">[]): number {
  const penalty = findings.reduce((sum, f) => sum + PENALTY[f.severity] * (f.overdue ? 2 : 1), 0);
  return Math.max(0, 100 - penalty);
}

/** Firm score: mean of company scores, so one large company cannot hide the rest. */
export function firmScore(companyScores: number[]): number | null {
  if (companyScores.length === 0) return null;
  return Math.round(companyScores.reduce((a, b) => a + b, 0) / companyScores.length);
}
