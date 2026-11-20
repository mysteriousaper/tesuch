import { firmScore, PENALTY, scoreFrom } from "../../lib/rules/score";
import type { EffectiveSeverity } from "../../lib/rules/types";

/** One row of public.company_stats: open findings by severity/overdue, or head count (kind = "staff"). */
export interface StatRow { company_id: string; kind: string; overdue: boolean; n: number | string }
/** `score` is null for a company with no staff: there is nothing to inspect yet, so no number is shown. */
export interface CompanyRow { id: string; name: string; score: number | null; open: number; staff: number }

const isSeverity = (k: string): k is EffectiveSeverity => k in PENALTY;

/** Same formula as inspectionReadyScore, from grouped counts instead of one row per finding. */
export function statsFor(rows: StatRow[], companyId: string): { score: number | null; open: number; staff: number } {
  let penalty = 0, open = 0, staff = 0, scoring = 0;
  for (const r of rows) {
    if (r.company_id !== companyId) continue;
    const n = Number(r.n);
    if (r.kind === "staff") staff += n;
    else if (isSeverity(r.kind)) {
      open += n;
      penalty += n * PENALTY[r.kind] * (r.overdue ? 2 : 1);
      if (r.kind !== "info") scoring += n;
    }
  }
  return { score: staff === 0 ? null : scoreFrom(penalty, scoring > 0), open, staff };
}

export function buildOverview(companies: { id: string; name: string }[], stats: StatRow[]) {
  const rows: CompanyRow[] = companies.map((c) => ({ id: c.id, name: c.name, ...statsFor(stats, c.id) }));
  // Companies without data sort last: they carry no risk signal.
  rows.sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity) || a.name.localeCompare(b.name));
  return { rows, firm: firmScore(rows.map((r) => r.score)) };
}
