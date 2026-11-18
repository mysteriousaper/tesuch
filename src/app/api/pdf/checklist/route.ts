import { ruleById } from "@/lib/notify/i18n";
import { renderChecklist } from "@/lib/pdf/render";
import { effectiveSeverity } from "@/lib/rules/engine";
import { inspectionReadyScore } from "@/lib/rules/score";
import type { Finding } from "@/lib/rules/types";
import { badRequest, locale as localeSchema, notFound, pdfResponse, today, unauthorized, userClient, uuid } from "../_lib/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/pdf/checklist?company=<id>&locale=hy|ru|en — open findings of one company. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const companyId = uuid.safeParse(q.get("company"));
  if (!companyId.success) return badRequest("company");
  const loc = localeSchema.safeParse(q.get("locale") ?? "hy");
  if (!loc.success) return badRequest("locale");

  const db = await userClient();
  if (!db) return unauthorized();
  const { data: company } = await db.from("companies").select("id, name, tax_id").eq("id", companyId.data).maybeSingle();
  if (!company) return notFound();

  const { data: rows } = await db
    .from("findings")
    .select("rule_id, rule_version, severity, due_date, employee_id, contract_id, employees(full_name)")
    .eq("company_id", company.id)
    .eq("status", "open")
    .order("due_date");

  const asOf = today();
  const items = (rows ?? []).flatMap((r) => {
    let rule;
    try {
      rule = ruleById(r.rule_id);
    } catch {
      return []; // rule removed from the catalog: skip rather than print an uncited line
    }
    const finding: Finding = {
      ruleId: rule.id,
      ruleVersion: r.rule_version,
      article: rule.article,
      sourceUrl: rule.source_url,
      ruleStatus: rule.status,
      // Recompute from the current rule status so a stale "red" never prints for an unverified rule.
      severity: effectiveSeverity(rule),
      companyId: company.id,
      employeeId: r.employee_id,
      contractId: r.contract_id,
      dueDate: r.due_date,
      overdue: r.due_date < asOf,
    };
    const emp = r.employees as unknown as { full_name: string } | null;
    return [{ finding, employeeName: emp?.full_name ?? "" }];
  });

  const pdf = await renderChecklist({
    locale: loc.data,
    company: { name: company.name, taxId: company.tax_id },
    asOf,
    score: inspectionReadyScore(items.map((i) => i.finding)),
    items,
  });
  return pdfResponse(pdf, `checklist-${loc.data}`, company.id);
}
