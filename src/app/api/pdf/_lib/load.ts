import { pdfDisposition } from "./filename";
import "server-only";
import { z } from "zod";
import { yerevanToday } from "@/components/documents/yerevan-date";
import { supabaseForUser } from "@/lib/supabase/server";

// Shared helpers for the PDF routes. Every read goes through the signed-in user's RLS client,
// so a user can only ever render documents for rows their org membership lets them see.

export const uuid = z.string().uuid();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s)));
export const locale = z.enum(["hy", "ru", "en"]);

/** Armenia's calendar date: documents are dated where the employer is, not in the server's UTC. */
export const today = () => yerevanToday();

export { pdfError } from "./error-page";

/** Signed-in user's client, or null. */
export async function userClient() {
  const supabase = await supabaseForUser();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

type Db = NonNullable<Awaited<ReturnType<typeof userClient>>>;

export interface ContractBundle {
  contract: {
    id: string;
    type: "indefinite" | "fixed_term";
    start_date: string;
    end_date: string | null;
    probation_end: string | null;
    terminated_on: string | null;
    termination_ground: string | null;
    workforce_reduction: boolean;
    employee_id: string;
  };
  employee: { id: string; full_name: string };
  company: { id: string; name: string; tax_id: string | null };
  /** Earliest contract start with this employer (service start for notice periods). */
  serviceStart: string;
}

/** Contract + employee + company, visible to the user under RLS, or null. */
export async function loadContract(db: Db, contractId: string): Promise<ContractBundle | null> {
  const { data } = await db
    .from("contracts")
    .select("id, type, start_date, end_date, probation_end, terminated_on, termination_ground, workforce_reduction, employee_id, employees(id, full_name, companies(id, name, tax_id))")
    .eq("id", contractId)
    .maybeSingle();
  const emp = data?.employees as unknown as { id: string; full_name: string; companies: ContractBundle["company"] | null } | null;
  if (!data || !emp?.companies) return null;

  const { data: all } = await db.from("contracts").select("start_date").eq("employee_id", emp.id);
  const serviceStart = (all ?? []).map((c) => c.start_date as string).reduce((a, b) => (a < b ? a : b), data.start_date as string);

  return {
    contract: data as unknown as ContractBundle["contract"],
    employee: { id: emp.id, full_name: emp.full_name },
    company: emp.companies,
    serviceStart,
  };
}

/** ASCII-only filename: transliterated names would be guesswork, so use a short id instead. */
export function pdfResponse(buf: Buffer, kind: string, id: string, label?: string): Response {
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": pdfDisposition(kind, id, today(), label),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
