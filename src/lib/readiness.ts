// Owner home: one readiness status for one business, and the few things to do this week.
// Pure functions only (no database, no React) so the thresholds are unit-tested.
import type { EffectiveSeverity } from "./rules/types";

export type Readiness = "none" | "ready" | "attention" | "risk";

/** Score at or above this (and nothing overdue) is "Ready". */
export const READY_MIN_SCORE = 90;
/** Score below this is "Risk". Between the two is "Needs attention". */
export const RISK_BELOW_SCORE = 60;
/** The owner home never shows more tasks than this. */
export const MAX_TASKS = 3;

export interface ReadinessInput {
  /** null = no staff yet, so nothing to inspect. */
  score: number | null;
  staff: number;
  /** Open issues that count towards the score (red, amber, advisory) and are past their due date. */
  overdueScoring: number;
}

export function readinessStatus({ score, staff, overdueScoring }: ReadinessInput): Readiness {
  if (staff === 0 || score === null) return "none";
  if (score < RISK_BELOW_SCORE) return "risk";
  if (score < READY_MIN_SCORE || overdueScoring > 0) return "attention";
  return "ready";
}

export interface TaskCandidate {
  ruleId: string;
  severity: EffectiveSeverity;
  dueDate: string;
  overdue: boolean;
  employeeId: string | null;
}

const WEIGHT: Record<EffectiveSeverity, number> = { red: 3, amber: 2, advisory: 1, info: 0 };

/**
 * The most urgent open issues, at most `limit`: overdue first, then severity, then the earliest due date.
 * "info" items are never tasks. The same rule for the same employee is listed once.
 */
export function pickTasks<T extends TaskCandidate>(items: T[], limit = MAX_TASKS): T[] {
  const seen = new Set<string>();
  return items
    .filter((i) => i.severity !== "info")
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || WEIGHT[b.severity] - WEIGHT[a.severity] || a.dueDate.localeCompare(b.dueDate))
    .filter((i) => {
      const key = `${i.ruleId}|${i.employeeId ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
