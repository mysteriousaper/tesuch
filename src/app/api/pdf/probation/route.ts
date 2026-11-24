import { z } from "zod";
import { renderProbationOrder } from "@/lib/pdf/render";
import { isoDate, loadContract, pdfError, pdfResponse, today, userClient, uuid } from "../_lib/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/pdf/probation?contract=<id>&decision=confirm|terminate[&termination=YYYY-MM-DD] */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const contractId = uuid.safeParse(q.get("contract"));
  if (!contractId.success) return pdfError(req, "invalid", "contract");
  const decision = z.enum(["confirm", "terminate"]).safeParse(q.get("decision") ?? "confirm");
  if (!decision.success) return pdfError(req, "invalid", "decision");
  const termination = q.get("termination") ? isoDate.safeParse(q.get("termination")) : null;
  if (termination && !termination.success) return pdfError(req, "invalid", "termination");

  const db = await userClient();
  if (!db) return pdfError(req, "unauthorized");
  const b = await loadContract(db, contractId.data);
  if (!b) return pdfError(req, "notFound");
  if (!b.contract.probation_end) return pdfError(req, "invalid", "contract: no probation");

  const pdf = await renderProbationOrder({
    company: { name: b.company.name, taxId: b.company.tax_id },
    employee: { name: b.employee.full_name },
    contractStart: b.contract.start_date,
    probationEnd: b.contract.probation_end,
    decision: decision.data,
    orderDate: today(),
    terminationDate: termination?.data ?? null,
  });
  return pdfResponse(pdf, `probation-${decision.data}`, b.contract.id, b.employee.full_name);
}
