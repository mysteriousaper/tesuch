import "server-only";
import { ruleById } from "@/lib/notify/i18n";
import { pickTasks, readinessStatus, type Readiness } from "@/lib/readiness";
import { effectiveSeverity } from "@/lib/rules/engine";
import type { supabaseForUser } from "@/lib/supabase/server";
import { companyStats, todayIso } from "./queries";
import { overdueScoringOf, statsFor } from "./stats";

type UserClient = Awaited<ReturnType<typeof supabaseForUser>>;

export interface OwnerTask { key: string; ruleId: string; employee: string | null; dueDate: string; overdue: boolean }
export interface OwnerSnapshot { status: Readiness; score: number | null; staff: number; open: number; tasks: OwnerTask[] }

/** Everything the owner home needs for one company, read through the user's RLS client. */
export async function ownerSnapshot(supabase: UserClient, orgId: string, companyId: string): Promise<OwnerSnapshot> {
  const today = todayIso();
  const [stats, findings] = await Promise.all([
    companyStats(supabase, orgId, companyId),
    supabase
      .from("findings")
      .select("id, rule_id, due_date, employee_id, employees(full_name)")
      .eq("company_id", companyId)
      .eq("status", "open")
      .order("due_date")
      .limit(200),
  ]);
  const own = statsFor(stats, companyId);
  const candidates = (findings.data ?? []).flatMap((r) => {
    let severity;
    try {
      // Recomputed from the current rule status, so a stale "red" never shows for an unverified rule.
      severity = effectiveSeverity(ruleById(r.rule_id));
    } catch {
      return []; // rule removed from the catalog
    }
    const emp = r.employees as unknown as { full_name: string } | null;
    return [{ key: r.id as string, ruleId: r.rule_id as string, severity, dueDate: r.due_date as string, overdue: (r.due_date as string) < today, employeeId: r.employee_id as string | null, employee: emp?.full_name ?? null }];
  });
  const tasks = pickTasks(candidates).map((c) => ({ key: c.key, ruleId: c.ruleId, employee: c.employee, dueDate: c.dueDate, overdue: c.overdue }));
  return {
    status: readinessStatus({ score: own.score, staff: own.staff, overdueScoring: overdueScoringOf(stats, companyId) }),
    score: own.score,
    staff: own.staff,
    open: own.open,
    tasks,
  };
}
