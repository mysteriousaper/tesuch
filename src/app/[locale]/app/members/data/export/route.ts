import { format } from "date-fns";
import { envelope, exportFilename, jsonDownload } from "@/components/members/lib";
import { emailsFor, orgExport, orgSession } from "@/components/members/server";

export const dynamic = "force-dynamic";

/** Whole-org JSON export for owners. Reads only through the owner's RLS client. */
export async function GET() {
  const { supabase, user, org } = await orgSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!org || org.role !== "owner") return new Response("Forbidden", { status: 403 });
  const data = await orgExport(supabase, org.id).catch(() => null);
  if (!data) return new Response("Export failed", { status: 500 });
  const emails = await emailsFor(data.members.map((m) => m.user_id as string));
  const members = data.members.map((m) => ({ ...m, email: emails.get(m.user_id as string) ?? null }));
  return jsonDownload(envelope("org", { ...data, members }), exportFilename("org", org.name, format(new Date(), "yyyy-MM-dd")));
}
