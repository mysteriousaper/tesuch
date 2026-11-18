import { timingSafeEqual } from "node:crypto";
import { format, isMonday } from "date-fns";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { toContract, toEmployee, toLeave, toRuleRow, type ContractRow, type EmployeeRow, type LeaveRow } from "@/lib/jobs/mappers";
import { planSync, type StoredFinding } from "@/lib/jobs/sync";
import { deliverAlerts, deliverDigest } from "@/lib/notify/deliver";
import type { Locale } from "@/lib/notify/i18n";
import type { AlertItem, DigestCompany } from "@/lib/notify/messages";
import { inspectionReadyScore } from "@/lib/rules/score";
import type { Finding } from "@/lib/rules/types";
import { RULES } from "@/lib/rules/catalog";
import { evaluateCompany } from "@/lib/rules/engine";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request, secret: string): boolean {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Nightly rule run. Called by Vercel Cron (see vercel.json). Alerts are sent from the new/reopened findings. */
export async function GET(req: Request) {
  const env = serverEnv();
  if (!authorized(req, env.CRON_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = supabaseService();
  const asOf = format(new Date(), "yyyy-MM-dd");

  // Rules table must hold every (id, version) the engine can cite.
  const { error: rulesErr } = await db.from("rules").upsert(RULES.map(toRuleRow), { onConflict: "id,version", ignoreDuplicates: true });
  if (rulesErr) return NextResponse.json({ error: `rules: ${rulesErr.message}` }, { status: 500 });

  const { data: companies, error } = await db.from("companies").select("id, org_id, name, orgs(locale)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = { companies: 0, inserted: 0, updated: 0, reopened: 0, autoResolved: 0, alertsSent: 0, digestsSent: 0, failed: [] as string[] };
  const monday = isMonday(new Date(`${asOf}T12:00:00Z`));
  const digests = new Map<string, { locale: Locale; companies: DigestCompany[] }>();

  for (const co of companies ?? []) {
    try {
      const [emp, con, lv, fnd] = await Promise.all([
        db.from("employees").select("id, company_id, birth_date, six_day_week, full_name").eq("company_id", co.id).is("archived_at", null),
        db.from("contracts").select("*, employees!inner(company_id)").eq("employees.company_id", co.id),
        db.from("leave_records").select("*, employees!inner(company_id)").eq("employees.company_id", co.id),
        db.from("findings").select("id, rule_id, rule_version, employee_id, contract_id, severity, due_date, status").eq("company_id", co.id),
      ]);
      for (const r of [emp, con, lv, fnd]) if (r.error) throw new Error(r.error.message);

      const computed = await evaluateCompany(
        RULES,
        {
          employees: (emp.data as EmployeeRow[]).map(toEmployee),
          contracts: (con.data as ContractRow[]).map(toContract),
          leave: (lv.data as LeaveRow[]).map(toLeave),
        },
        asOf,
      );
      const plan = planSync(co.org_id, computed, fnd.data as StoredFinding[]);

      const locale = ((co.orgs as unknown as { locale?: string } | null)?.locale ?? "hy") as Locale;
      const names = new Map((emp.data as (EmployeeRow & { full_name: string })[]).map((e) => [e.id, e.full_name]));
      const key = (f: { rule_id?: string; ruleId?: string; employee_id?: string; employeeId?: string; contract_id?: string | null; contractId?: string | null }) =>
        `${f.rule_id ?? f.ruleId}|${f.employee_id ?? f.employeeId}|${(f.contract_id ?? f.contractId) ?? ""}`;
      const byKey = new Map(computed.map((f) => [key(f), f]));
      const storedKey = new Map((fnd.data as StoredFinding[]).map((x) => [x.id, key(x)]));
      const item = (f: Finding): AlertItem => ({ finding: f, companyName: co.name, employeeName: names.get(f.employeeId) ?? "" });
      const toAlert: (AlertItem & { findingId: string })[] = [];

      if (plan.inserts.length) {
        const { data: ins, error: e } = await db.from("findings").insert(plan.inserts).select("id, rule_id, employee_id, contract_id");
        if (e) throw new Error(e.message);
        for (const r of ins ?? []) {
          const f = byKey.get(key(r));
          if (f && f.severity !== "info") toAlert.push({ ...item(f), findingId: r.id });
        }
      }
      for (const u of plan.updates) {
        const patch = { rule_version: u.rule_version, severity: u.severity, due_date: u.due_date, status: u.status, last_seen_at: new Date().toISOString() };
        const { error: e } = await db.from("findings").update(patch).eq("id", u.id);
        if (e) throw new Error(e.message);
        const f = byKey.get(storedKey.get(u.id) ?? "");
        if (u.reopened && f) toAlert.push({ ...item(f), findingId: u.id });
      }
      if (plan.autoResolve.length) {
        const { error: e } = await db.from("findings").update({ status: "fixed" }).in("id", plan.autoResolve);
        if (e) throw new Error(e.message);
      }

      summary.alertsSent += await deliverAlerts(db, co.org_id, locale, toAlert);
      if (monday && computed.length) {
        const d = digests.get(co.org_id) ?? { locale, companies: [] };
        d.companies.push({ companyName: co.name, score: inspectionReadyScore(computed), items: computed.map(item) });
        digests.set(co.org_id, d);
      }

      summary.companies++;
      summary.inserted += plan.inserts.length;
      summary.updated += plan.updates.length;
      summary.reopened += plan.updates.filter((u) => u.reopened).length;
      summary.autoResolved += plan.autoResolve.length;
    } catch (e) {
      // One broken company must not stop the run for everyone else.
      summary.failed.push(`${co.id}: ${(e as Error).message}`);
    }
  }

  for (const [orgId, d] of digests) {
    try {
      summary.digestsSent += await deliverDigest(db, orgId, d.locale, d.companies);
    } catch (e) {
      summary.failed.push(`digest ${orgId}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ asOf, ...summary }, { status: summary.failed.length ? 207 : 200 });
}
