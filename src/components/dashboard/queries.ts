import "server-only";
import { format } from "date-fns";
import { firmScore, inspectionReadyScore } from "@/lib/rules/score";
import type { EffectiveSeverity } from "@/lib/rules/types";
import type { supabaseForUser } from "@/lib/supabase/server";

type UserClient = Awaited<ReturnType<typeof supabaseForUser>>;
export type Role = "owner" | "accountant" | "viewer";

export interface OrgInfo { id: string; name: string; locale: string; role: Role }

export const todayIso = () => format(new Date(), "yyyy-MM-dd");

/** The user's first org (by membership age) and their role in it. All reads go through RLS. */
export async function currentOrg(supabase: UserClient, userId: string): Promise<OrgInfo | null> {
  const { data } = await supabase
    .from("memberships").select("role, created_at, orgs(id, name, locale)").eq("user_id", userId).order("created_at").limit(1).maybeSingle();
  const org = data?.orgs as unknown as { id: string; name: string; locale: string } | null;
  return data && org ? { ...org, role: data.role as Role } : null;
}

export interface OpenFinding { severity: EffectiveSeverity; due_date: string }

export function scoreOf(findings: OpenFinding[], today = todayIso()) {
  return inspectionReadyScore(findings.map((f) => ({ severity: f.severity, overdue: f.due_date < today })));
}

export interface CompanyRow { id: string; name: string; score: number; open: number; staff: number }

/** Companies with score, open-finding count and head count, riskiest first. */
export async function firmOverview(supabase: UserClient, orgId: string) {
  const [companies, findings, employees] = await Promise.all([
    supabase.from("companies").select("id, name").eq("org_id", orgId),
    supabase.from("findings").select("company_id, severity, due_date").eq("org_id", orgId).eq("status", "open"),
    supabase.from("employees").select("company_id").eq("org_id", orgId).is("archived_at", null),
  ]);
  const today = todayIso();
  const rows: CompanyRow[] = (companies.data ?? []).map((c) => {
    const open = (findings.data ?? []).filter((f) => f.company_id === c.id) as OpenFinding[];
    return {
      id: c.id,
      name: c.name,
      score: scoreOf(open, today),
      open: open.length,
      staff: (employees.data ?? []).filter((e) => e.company_id === c.id).length,
    };
  });
  rows.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return { rows, firm: firmScore(rows.map((r) => r.score)) };
}
