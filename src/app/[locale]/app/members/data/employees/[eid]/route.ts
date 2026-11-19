import { format } from "date-fns";
import { z } from "zod";
import { envelope, exportFilename, jsonDownload } from "@/components/members/lib";
import { employeeExport } from "@/components/members/server";
import { supabaseForUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** One employee's data as JSON (any member of the employee's org; RLS decides visibility, others get 404). */
export async function GET(_req: Request, { params }: { params: Promise<{ eid: string }> }) {
  const eid = z.string().uuid().safeParse((await params).eid);
  if (!eid.success) return new Response("Not found", { status: 404 });
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const data = await employeeExport(supabase, eid.data).catch(() => undefined);
  if (data === undefined) return new Response("Export failed", { status: 500 });
  if (!data) return new Response("Not found", { status: 404 });
  return jsonDownload(envelope("employee", data), exportFilename("employee", data.employee.full_name as string, format(new Date(), "yyyy-MM-dd")));
}
