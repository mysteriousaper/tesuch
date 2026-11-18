import { z } from "zod";
import { renderProbationOrder } from "@/lib/pdf/render";
import { badRequest, isoDate, loadContract, notFound, pdfResponse, today, unauthorized, userClient, uuid } from "../_lib/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/pdf/probation?contract=<id>&decision=confirm|terminate[&termination=YYYY-MM-DD] */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const contractId = uuid.safeParse(q.get("contract"));
  if (!contractId.success) return badRequest("contract");
  const decision = z.enum(["confirm", "terminate"]).safeParse(q.get("decision") ?? "confirm");
  if (!decision.success) return badRequest("decision");
  const termination = q.get("termination") ? isoDate.safeParse(q.get("termination")) : null;
  if (termination && !termination.success) return badRequest("termination");

  const db = await userClient();
  if (!db) return unauthorized();
  const b = await loadContract(db, contractId.data);
  if (!b) return notFound();
  if (!b.contract.probation_end) return badRequest("contract: no probation");

  const pdf = await renderProbationOrder({
    company: { name: b.company.name, taxId: b.company.tax_id },
    employee: { name: b.employee.full_name },
    contractStart: b.contract.start_date,
    probationEnd: b.contract.probation_end,
    decision: decision.data,
    orderDate: today(),
    terminationDate: termination?.data ?? null,
  });
  return pdfResponse(pdf, `probation-${decision.data}`, b.contract.id);
}
