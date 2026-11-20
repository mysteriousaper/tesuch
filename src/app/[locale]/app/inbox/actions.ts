"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseForUser } from "@/lib/supabase/server";

export type AssignState = { ok: true } | { ok: false; error: "generic" | "invalid" | "forbidden" | "notMember" };

const schema = z.object({ findingId: z.string().uuid(), assigneeId: z.string().uuid().nullable() });
const fail = (error: Extract<AssignState, { ok: false }>["error"]): AssignState => ({ ok: false, error });

/**
 * Assign a finding to a colleague (or clear it with null). Runs entirely on the user's RLS client:
 * the org comes from the finding row as the user sees it, never from the client. The database enforces the rest
 * (RLS can_edit, assignee is an owner/accountant of the same org, only status/assignee_id writable) and audits the change.
 */
export async function assignFinding(locale: string, findingId: string, assigneeId: string | null): Promise<AssignState> {
  const parsed = schema.safeParse({ findingId, assigneeId });
  if (!parsed.success) return fail("invalid");
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("forbidden");

  const { data: finding } = await supabase.from("findings").select("id, org_id").eq("id", parsed.data.findingId).maybeSingle();
  if (!finding) return fail("forbidden");
  const { data: mine } = await supabase.from("memberships").select("role").eq("org_id", finding.org_id).eq("user_id", user.id).maybeSingle();
  if (mine?.role !== "owner" && mine?.role !== "accountant") return fail("forbidden");

  if (parsed.data.assigneeId) {
    const { data: target } = await supabase.from("memberships").select("role").eq("org_id", finding.org_id).eq("user_id", parsed.data.assigneeId).maybeSingle();
    if (target?.role !== "owner" && target?.role !== "accountant") return fail("notMember");
  }

  const { data, error } = await supabase.from("findings").update({ assignee_id: parsed.data.assigneeId }).eq("id", finding.id).select("id");
  if (error) return fail(/assignee_not_member/.test(error.message) ? "notMember" : "generic");
  if (!data?.length) return fail("forbidden");
  revalidatePath(`/${locale}/app/inbox`);
  return { ok: true };
}
