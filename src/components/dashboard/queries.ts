import "server-only";
import { format } from "date-fns";
import { cookies } from "next/headers";
import { inspectionReadyScore } from "@/lib/rules/score";
import type { EffectiveSeverity } from "@/lib/rules/types";
import type { supabaseForUser } from "@/lib/supabase/server";

import { buildOverview, type StatRow } from "./stats";
import { pickOrg, type OrgInfo, type Role } from "./pick-org";

export type { OrgInfo, Role };
type UserClient = Awaited<ReturnType<typeof supabaseForUser>>;

export const todayIso = () => format(new Date(), "yyyy-MM-dd");

/** Cookie holding the org the user last picked. Only a hint: it is always checked against memberships. */
export const ORG_COOKIE = "tesuch_org";

/**
 * Every org the user belongs to, oldest membership first (ties broken by org id, so the default org never
 * flips between requests). Read through RLS; rows are re-checked to be the caller's own memberships.
 * Memberships are only created by create_org / accept_invitation, so created_at cannot be backdated by a client.
 */
export async function userOrgs(supabase: UserClient, userId: string): Promise<OrgInfo[]> {
  const { data } = await supabase
    .from("memberships")
    .select("user_id, org_id, role, created_at, orgs(id, name, locale)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("org_id", { ascending: true });
  return (data ?? []).flatMap((m) => {
    const org = m.orgs as unknown as { id: string; name: string; locale: string } | null;
    if (!org || m.user_id !== userId || org.id !== m.org_id) return [];
    if (m.role !== "owner" && m.role !== "accountant" && m.role !== "viewer") return [];
    return [{ ...org, role: m.role as Role }];
  });
}

/** The org the user is working in (cookie choice, validated against memberships) and their role in it. */
export async function currentOrg(supabase: UserClient, userId: string): Promise<OrgInfo | null> {
  const store = await cookies();
  return pickOrg(await userOrgs(supabase, userId), store.get(ORG_COOKIE)?.value);
}

export interface OpenFinding { severity: EffectiveSeverity; due_date: string }

export function scoreOf(findings: OpenFinding[], today = todayIso()) {
  return inspectionReadyScore(findings.map((f) => ({ severity: f.severity, overdue: f.due_date < today })));
}

export type { CompanyRow } from "./stats";

/** Grouped counts from the database (no 1000-row cap). Optionally for one company. */
export async function companyStats(supabase: UserClient, orgId: string, companyId?: string): Promise<StatRow[]> {
  const { data, error } = await supabase.rpc("company_stats", { p_org: orgId, p_today: todayIso(), p_company: companyId ?? null });
  if (error) throw new Error(error.message);
  return (data ?? []) as StatRow[];
}

/** Companies with score, open-finding count and head count, riskiest first. */
export async function firmOverview(supabase: UserClient, orgId: string) {
  const [companies, stats] = await Promise.all([
    supabase.from("companies").select("id, name").eq("org_id", orgId).limit(1000),
    companyStats(supabase, orgId),
  ]);
  return buildOverview(companies.data ?? [], stats);
}
