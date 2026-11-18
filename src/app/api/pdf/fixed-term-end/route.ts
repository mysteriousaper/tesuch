import { renderFixedTermEndNotice } from "@/lib/pdf/render";
import { badRequest, loadContract, notFound, pdfResponse, today, unauthorized, userClient, uuid } from "../_lib/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/pdf/fixed-term-end?contract=<id> */
export async function GET(req: Request) {
  const contractId = uuid.safeParse(new URL(req.url).searchParams.get("contract"));
  if (!contractId.success) return badRequest("contract");

  const db = await userClient();
  if (!db) return unauthorized();
  const b = await loadContract(db, contractId.data);
  if (!b) return notFound();
  if (b.contract.type !== "fixed_term" || !b.contract.end_date) return badRequest("contract: not fixed-term");

  const pdf = await renderFixedTermEndNotice({
    company: { name: b.company.name, taxId: b.company.tax_id },
    employee: { name: b.employee.full_name },
    contractStart: b.contract.start_date,
    contractEnd: b.contract.end_date,
    noticeDate: today(),
  });
  return pdfResponse(pdf, "fixed-term-end", b.contract.id);
}
