import type { EffectiveSeverity, Finding, IsoDate } from "@/lib/rules/types";

/** A findings row as stored in the database. */
export interface StoredFinding {
  id: string;
  rule_id: string;
  rule_version: number;
  employee_id: string;
  contract_id: string | null;
  severity: EffectiveSeverity;
  due_date: IsoDate;
  status: "open" | "fixed" | "dismissed";
}

export interface FindingInsert {
  org_id: string;
  company_id: string;
  employee_id: string;
  contract_id: string | null;
  rule_id: string;
  rule_version: number;
  severity: EffectiveSeverity;
  due_date: IsoDate;
}

export interface SyncPlan {
  inserts: FindingInsert[];
  /** Still produced by the engine: refresh version/severity/due, and reopen if a user marked it fixed. */
  updates: { id: string; rule_version: number; severity: EffectiveSeverity; due_date: IsoDate; status: "open"; reopened: boolean }[];
  /** Open in the database but no longer produced: the underlying data was fixed. */
  autoResolve: string[];
}

const key = (ruleId: string, employeeId: string, contractId: string | null) => `${ruleId}|${employeeId}|${contractId ?? ""}`;

/**
 * Pure diff between what the engine produced tonight and what is stored.
 * - dismissed findings stay dismissed (a human decided), even if the rule still fires;
 * - "fixed" findings that the engine still produces are reopened (the fix didn't stick).
 */
export function planSync(orgId: string, computed: Finding[], stored: StoredFinding[]): SyncPlan {
  const byKey = new Map(stored.map((s) => [key(s.rule_id, s.employee_id, s.contract_id), s]));
  const seen = new Set<string>();
  const plan: SyncPlan = { inserts: [], updates: [], autoResolve: [] };

  for (const f of computed) {
    const k = key(f.ruleId, f.employeeId, f.contractId);
    if (seen.has(k)) continue;
    seen.add(k);
    const s = byKey.get(k);
    if (!s) {
      plan.inserts.push({
        org_id: orgId,
        company_id: f.companyId,
        employee_id: f.employeeId,
        contract_id: f.contractId,
        rule_id: f.ruleId,
        rule_version: f.ruleVersion,
        severity: f.severity,
        due_date: f.dueDate,
      });
    } else if (s.status !== "dismissed") {
      const changed = s.status !== "open" || s.rule_version !== f.ruleVersion || s.severity !== f.severity || s.due_date !== f.dueDate;
      if (changed) {
        plan.updates.push({ id: s.id, rule_version: f.ruleVersion, severity: f.severity, due_date: f.dueDate, status: "open", reopened: s.status === "fixed" });
      }
    }
  }

  for (const [k, s] of byKey) {
    if (!seen.has(k) && s.status === "open") plan.autoResolve.push(s.id);
  }
  return plan;
}
