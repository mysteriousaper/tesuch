import { ruleById } from "@/lib/notify/i18n";
import { renderChecklist } from "@/lib/pdf/render";
import { effectiveSeverity } from "@/lib/rules/engine";
import { inspectionReadyScore } from "@/lib/rules/score";
import type { Finding } from "@/lib/rules/types";
import { locale as localeSchema, pdfError, pdfResponse, today, userClient, uuid } from "../_lib/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/pdf/checklist?company=<id>&locale=hy|ru|en[&pack=1] — open findings of one company; pack=1 adds the documents-to-have-ready page. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const companyId = uuid.safeParse(q.get("company"));
  if (!companyId.success) return pdfError(req, "invalid", "company");
  const loc = localeSchema.safeParse(q.get("locale") ?? "hy");
  if (!loc.success) return pdfError(req, "invalid", "locale");

  const db = await userClient();
  if (!db) return pdfError(req, "unauthorized");
  const { data: company } = await db.from("companies").select("id, name, tax_id").eq("id", companyId.data).maybeSingle();
  if (!company) return pdfError(req, "notFound");

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

  const { count: staff, error: staffErr } = await db
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .is("archived_at", null);

  // Only the pack lists the checklist ticks. An error (table not migrated yet) reads as nothing ticked.
  const pack = q.get("pack") === "1";
  const ticked = pack
    ? ((await db.from("checklist_ticks").select("question_no").eq("company_id", company.id)).data ?? []).map((r) => r.question_no as string)
    : [];

  const pdf = await renderChecklist({
    locale: loc.data,
    company: { name: company.name, taxId: company.tax_id },
    asOf,
    pack,
    ticked,
    // Unknown head count (query error) falls back to scoring; zero staff has no score.
    score: !staffErr && staff === 0 ? null : inspectionReadyScore(items.map((i) => i.finding)),
    items,
  });
  return pdfResponse(pdf, `checklist-${loc.data}`, company.id);
}
