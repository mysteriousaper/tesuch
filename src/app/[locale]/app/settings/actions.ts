"use server";

import { revalidatePath } from "next/cache";
import { currentOrg } from "@/components/dashboard/queries";
import { supabaseForUser } from "@/lib/supabase/server";
import { FAIL, isOwnerRole, type ActionState } from "../dashboard-logic";

/**
 * Turn privacy mode ("code instead of name") on or off for the firm the user is working in. Owners only.
 * The org comes from the user's own membership row, never from the client; the database policy (orgs_update, owner only)
 * is the second lock, and the change is written to the audit log by a trigger.
 */
export async function setPrivacyMode(locale: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return FAIL("forbidden");
  const org = await currentOrg(supabase, user.id);
  if (!org || !isOwnerRole(org.role)) return FAIL("forbidden");

  const enabled = form.get("enabled") === "on";
  const { data, error } = await supabase.from("orgs").update({ privacy_mode: enabled }).eq("id", org.id).select("id");
  if (error) return FAIL("generic");
  if (!data?.length) return FAIL("forbidden");
  revalidatePath(`/${locale}/app`, "layout");
  return { ok: true };
}

/**
 * Answer the one-time "store employees by code" notice (owners only). `enable` also turns privacy mode on;
 * either way the notice is dismissed. Same checks as setPrivacyMode: org from the membership row, orgs_update as second lock.
 */
export async function answerCodesNotice(locale: string, enable: boolean): Promise<void> {
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const org = await currentOrg(supabase, user.id);
  if (!org || !isOwnerRole(org.role)) return;
  await supabase.from("orgs").update(enable ? { privacy_mode: true, codes_notice_dismissed: true } : { codes_notice_dismissed: true }).eq("id", org.id);
  revalidatePath(`/${locale}/app`, "layout");
}
