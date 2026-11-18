import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverAlerts } from "@/lib/notify/deliver";
import type { Locale } from "@/lib/notify/i18n";
import type { AlertItem } from "@/lib/notify/messages";
import { RULES } from "@/lib/rules/catalog";
import { evaluateCompany } from "@/lib/rules/engine";
import { inspectionReadyScore } from "@/lib/rules/score";
import type { Finding } from "@/lib/rules/types";
import { toContract, toEmployee, toLeave, toRuleRow, type ContractRow, type EmployeeRow, type LeaveRow } from "./mappers";
import { planSync, type StoredFinding } from "./sync";

export interface CompanyRef {
  id: string;
  org_id: string;
  name: string;
  locale?: Locale;
}

export interface CompanyRunResult {
  computed: Finding[];
  items: AlertItem[];
  score: number;
  inserted: number;
  updated: number;
  reopened: number;
  autoResolved: number;
  alertsSent: number;
}

/** Make sure the rules table holds every (id, version) the engine can cite. Idempotent. */
export async function ensureRules(db: SupabaseClient) {
  const { error } = await db.from("rules").upsert(RULES.map(toRuleRow), { onConflict: "id,version", ignoreDuplicates: true });
  if (error) throw new Error(`rules: ${error.message}`);
}

/**
 * Evaluate one company and sync its findings. Used by the nightly job and on demand (after import, "re-check now").
 * Must be called with a SERVICE-ROLE client: findings are written only by the system.
 * Callers acting for a user must first check that the user can edit the company's org.
 */
export async function runRulesForCompany(
  db: SupabaseClient, co: CompanyRef, asOf: string, opts: { sendAlerts: boolean },
): Promise<CompanyRunResult> {
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
  const stored = fnd.data as StoredFinding[];
  const plan = planSync(co.org_id, computed, stored);

  const names = new Map((emp.data as (EmployeeRow & { full_name: string })[]).map((e) => [e.id, e.full_name]));
  const key = (rule: string, employee: string, contract: string | null) => `${rule}|${employee}|${contract ?? ""}`;
  const byKey = new Map(computed.map((f) => [key(f.ruleId, f.employeeId, f.contractId), f]));
  const storedKey = new Map(stored.map((x) => [x.id, key(x.rule_id, x.employee_id, x.contract_id)]));
  const item = (f: Finding): AlertItem => ({ finding: f, companyName: co.name, employeeName: names.get(f.employeeId) ?? "" });
  const toAlert: (AlertItem & { findingId: string })[] = [];

  if (plan.inserts.length) {
    const { data: ins, error } = await db.from("findings").insert(plan.inserts).select("id, rule_id, employee_id, contract_id");
    if (error) throw new Error(error.message);
    for (const r of ins ?? []) {
      const f = byKey.get(key(r.rule_id, r.employee_id, r.contract_id));
      if (f && f.severity !== "info") toAlert.push({ ...item(f), findingId: r.id });
    }
  }
  for (const u of plan.updates) {
    const patch = { rule_version: u.rule_version, severity: u.severity, due_date: u.due_date, status: u.status, last_seen_at: new Date().toISOString() };
    const { error } = await db.from("findings").update(patch).eq("id", u.id);
    if (error) throw new Error(error.message);
    const f = byKey.get(storedKey.get(u.id) ?? "");
    if (u.reopened && f) toAlert.push({ ...item(f), findingId: u.id });
  }
  if (plan.autoResolve.length) {
    const { error } = await db.from("findings").update({ status: "fixed" }).in("id", plan.autoResolve);
    if (error) throw new Error(error.message);
  }

  const alertsSent = opts.sendAlerts ? await deliverAlerts(db, co.org_id, co.locale ?? "hy", toAlert) : 0;
  return {
    computed,
    items: computed.map(item),
    score: inspectionReadyScore(computed),
    inserted: plan.inserts.length,
    updated: plan.updates.length,
    reopened: plan.updates.filter((u) => u.reopened).length,
    autoResolved: plan.autoResolve.length,
    alertsSent,
  };
}
