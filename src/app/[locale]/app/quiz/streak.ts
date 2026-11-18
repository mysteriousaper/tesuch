// Turns stored quiz attempts + findings history into WeekRecords for src/lib/quiz streaks and badges. Pure.
import { endOfISOWeek, format, setISOWeek, startOfISOWeekYear } from "date-fns";
import { isCleanWeek, type IsoWeek, type WeekRecord } from "../../../../lib/quiz/quiz";

export interface AttemptRow {
  iso_week: string;
  score: number;
}

export interface FindingHistoryRow {
  severity: string;
  due_date: string;
  first_seen_at: string;
  resolved_at: string | null;
}

export const weekKey = (w: IsoWeek) => `${w.year}-W${String(w.week).padStart(2, "0")}`;

export function parseWeekKey(key: string): IsoWeek | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  return m ? { year: Number(m[1]), week: Number(m[2]) } : null;
}

/** Sunday of the ISO week, as YYYY-MM-DD. */
export function weekEnd(w: IsoWeek): string {
  return format(endOfISOWeek(setISOWeek(startOfISOWeekYear(new Date(w.year, 0, 4)), w.week)), "yyyy-MM-dd");
}

/**
 * Approximation (no daily snapshots are stored): a finding counts as open at `date` if it was first seen
 * on or before that day and not resolved (fixed or dismissed) until after it. Overdue = due before `date`.
 */
export function wasCleanAt(findings: FindingHistoryRow[], date: string): boolean {
  return isCleanWeek(
    findings.map((f) => ({
      status: f.first_seen_at.slice(0, 10) <= date && (f.resolved_at === null || f.resolved_at.slice(0, 10) > date) ? "open" : "closed",
      severity: f.severity,
      overdue: f.due_date < date,
    })),
  );
}

/** One record per week with an attempt. The current week is judged as of today, not its future Sunday. */
export function buildWeekRecords(attempts: AttemptRow[], findings: FindingHistoryRow[], today: string): WeekRecord[] {
  const out: WeekRecord[] = [];
  for (const a of attempts) {
    const w = parseWeekKey(a.iso_week);
    if (!w) continue;
    const end = weekEnd(w);
    out.push({ ...w, clean: wasCleanAt(findings, end < today ? end : today), quizTaken: true, quizPercent: a.score });
  }
  return out;
}
