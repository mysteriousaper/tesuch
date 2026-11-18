import { timingSafeEqual } from "node:crypto";
import { format } from "date-fns";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { toContract, toEmployee, toLeave, toRuleRow, type ContractRow, type EmployeeRow, type LeaveRow } from "@/lib/jobs/mappers";
import { planSync, type StoredFinding } from "@/lib/jobs/sync";
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

  const { data: companies, error } = await db.from("companies").select("id, org_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = { companies: 0, inserted: 0, updated: 0, reopened: 0, autoResolved: 0, failed: [] as string[] };

  for (const co of companies ?? []) {
    try {
      const [emp, con, lv, fnd] = await Promise.all([
        db.from("employees").select("id, company_id, birth_date, six_day_week").eq("company_id", co.id).is("archived_at", null),
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

      if (plan.inserts.length) {
        const { error: e } = await db.from("findings").insert(plan.inserts);
        if (e) throw new Error(e.message);
      }
      for (const u of plan.updates) {
        const patch = { rule_version: u.rule_version, severity: u.severity, due_date: u.due_date, status: u.status, last_seen_at: new Date().toISOString() };
        const { error: e } = await db.from("findings").update(patch).eq("id", u.id);
        if (e) throw new Error(e.message);
      }
      if (plan.autoResolve.length) {
        const { error: e } = await db.from("findings").update({ status: "fixed" }).in("id", plan.autoResolve);
        if (e) throw new Error(e.message);
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

  return NextResponse.json({ asOf, ...summary }, { status: summary.failed.length ? 207 : 200 });
}
