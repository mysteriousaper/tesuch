import { firmScore, PENALTY } from "../../lib/rules/score";
import type { EffectiveSeverity } from "../../lib/rules/types";

/** One row of public.company_stats: open findings by severity/overdue, or head count (kind = "staff"). */
export interface StatRow { company_id: string; kind: string; overdue: boolean; n: number | string }
export interface CompanyRow { id: string; name: string; score: number; open: number; staff: number }

const isSeverity = (k: string): k is EffectiveSeverity => k in PENALTY;

/** Same formula as inspectionReadyScore, from grouped counts instead of one row per finding. */
export function statsFor(rows: StatRow[], companyId: string) {
  let penalty = 0, open = 0, staff = 0;
  for (const r of rows) {
    if (r.company_id !== companyId) continue;
    const n = Number(r.n);
    if (r.kind === "staff") staff += n;
    else if (isSeverity(r.kind)) { open += n; penalty += n * PENALTY[r.kind] * (r.overdue ? 2 : 1); }
  }
  return { score: Math.max(0, 100 - penalty), open, staff };
}

export function buildOverview(companies: { id: string; name: string }[], stats: StatRow[]) {
  const rows: CompanyRow[] = companies.map((c) => ({ id: c.id, name: c.name, ...statsFor(stats, c.id) }));
  rows.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return { rows, firm: firmScore(rows.map((r) => r.score)) };
}
