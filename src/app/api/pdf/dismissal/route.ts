import { renderDismissalNotice } from "@/lib/pdf/render";
import { isoDate, loadContract, pdfError, pdfResponse, today, userClient, uuid } from "../_lib/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/pdf/dismissal?contract=<id>[&date=YYYY-MM-DD][&termination=YYYY-MM-DD]
 * `date` is the notice date (default today). Termination defaults to the contract's terminated_on,
 * else the earliest date the notice period allows; the PDF warns if it is too early.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const contractId = uuid.safeParse(q.get("contract"));
  if (!contractId.success) return pdfError(req, "invalid", "contract");
  const date = isoDate.safeParse(q.get("date") || today());
  if (!date.success) return pdfError(req, "invalid", "date");
  const termination = q.get("termination") ? isoDate.safeParse(q.get("termination")) : null;
  if (termination && !termination.success) return pdfError(req, "invalid", "termination");

  const db = await userClient();
  if (!db) return pdfError(req, "unauthorized");
  const b = await loadContract(db, contractId.data);
  if (!b) return pdfError(req, "notFound");

  const pdf = await renderDismissalNotice({
    company: { name: b.company.name, taxId: b.company.tax_id },
    employee: { name: b.employee.full_name },
    serviceStart: b.serviceStart,
    noticeDate: date.data,
    terminationDate: termination?.data ?? b.contract.terminated_on,
    ground: b.contract.termination_ground,
    workforceReduction: b.contract.workforce_reduction,
  });
  return pdfResponse(pdf, "dismissal", b.contract.id, b.employee.full_name);
}
