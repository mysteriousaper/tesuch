"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { baseUrl, emailsFor, orgSession } from "@/components/members/server";
import { inviteSchema, inviteUrl, memberErrorKey, roleChangeSchema } from "@/components/members/lib";
import { escapeHtml } from "@/lib/notify/i18n";
import { sendEmailResend } from "@/lib/notify/send";

export type MembersError = "generic" | "invalid" | "forbidden" | "lastOwner" | "pending" | "alreadyMember";
/** `error` is a key in members.errors. */
export type MembersState =
  | { ok: true; link?: string; emailed?: boolean; email?: string }
  | { ok: false; error: MembersError }
  | null;

const fail = (error: MembersError): MembersState => ({ ok: false, error });
const uuid = z.string().uuid();
const LOCALES = ["hy", "ru", "en"] as const;
const safeLocale = (l: string) => (LOCALES as readonly string[]).includes(l) ? l : "hy";

/** The current org if the caller owns it. Every owner check is repeated by RLS. */
async function ownerSession() {
  const s = await orgSession();
  return s.user && s.org?.role === "owner" ? { ...s, user: s.user, org: s.org } : null;
}

export async function inviteMember(locale: string, _prev: MembersState, form: FormData): Promise<MembersState> {
  const parsed = inviteSchema.safeParse({ email: form.get("email"), role: form.get("role") });
  if (!parsed.success) return fail("invalid");
  const s = await ownerSession();
  if (!s) return fail("forbidden");
  const { supabase, org, user } = s;
  const { email, role } = parsed.data;

  const { data: members } = await supabase.from("memberships").select("user_id").eq("org_id", org.id);
  const emails = await emailsFor((members ?? []).map((m) => m.user_id as string));
  if ([...emails.values()].some((e) => e.toLowerCase() === email)) return fail("alreadyMember");

  // Re-inviting replaces the open invitation (new token, new 7-day window).
  await supabase.from("invitations").delete().eq("org_id", org.id).eq("email", email).is("accepted_at", null);
  const { data, error } = await supabase.from("invitations").insert({ org_id: org.id, email, role }).select("token").single();
  if (error || !data) return fail(error ? (memberErrorKey(error.message) === "pending" ? "pending" : "generic") : "generic");

  const loc = safeLocale(locale);
  const link = inviteUrl(await baseUrl(), loc, data.token as string);
  const emailed = await sendInviteEmail(loc, email, link, org.name, user.email ?? "", role);
  revalidatePath(`/${loc}/app/members`);
  return { ok: true, link, emailed, email };
}

/** Best effort: Resend's free tier only delivers to the account owner, so the UI always shows the link too. */
async function sendInviteEmail(locale: string, to: string, link: string, orgName: string, inviter: string, role: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;
  if (!key || !from) return false;
  const t = await getTranslations({ locale, namespace: "members.email" });
  const r = await getTranslations({ locale, namespace: "members.roles" });
  const vars = { org: orgName, inviter: inviter || "Tesuch", role: r(role) };
  const subject = t("subject", vars);
  const body = t("body", vars);
  const res = await sendEmailResend(key, {
    from,
    to,
    subject,
    text: `${body}\n\n${t("cta")}: ${link}\n\n${t("expires")}`,
    html: `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(link)}">${escapeHtml(t("cta"))}</a></p><p style="color:#666">${escapeHtml(t("expires"))}</p>`,
  });
  return res.ok;
}

export async function revokeInvite(locale: string, _prev: MembersState, form: FormData): Promise<MembersState> {
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return fail("invalid");
  const s = await ownerSession();
  if (!s) return fail("forbidden");
  const { data, error } = await s.supabase.from("invitations").delete().eq("id", id.data).eq("org_id", s.org.id).select("id");
  if (error) return fail("generic");
  if (!data?.length) return fail("forbidden");
  revalidatePath(`/${safeLocale(locale)}/app/members`);
  return { ok: true };
}

export async function changeRole(locale: string, _prev: MembersState, form: FormData): Promise<MembersState> {
  const parsed = roleChangeSchema.safeParse({ user_id: form.get("user_id"), role: form.get("role") });
  if (!parsed.success) return fail("invalid");
  const s = await ownerSession();
  if (!s) return fail("forbidden");
  const { data, error } = await s.supabase
    .from("memberships").update({ role: parsed.data.role }).eq("org_id", s.org.id).eq("user_id", parsed.data.user_id).select("user_id");
  if (error) return fail(memberErrorKey(error.message) === "lastOwner" ? "lastOwner" : "generic");
  if (!data?.length) return fail("forbidden");
  revalidatePath(`/${safeLocale(locale)}/app`, "layout");
  return { ok: true };
}

export async function removeMember(locale: string, _prev: MembersState, form: FormData): Promise<MembersState> {
  const id = uuid.safeParse(form.get("user_id"));
  if (!id.success) return fail("invalid");
  const s = await ownerSession();
  if (!s) return fail("forbidden");
  const { data, error } = await s.supabase.from("memberships").delete().eq("org_id", s.org.id).eq("user_id", id.data).select("user_id");
  if (error) return fail(memberErrorKey(error.message) === "lastOwner" ? "lastOwner" : "generic");
  if (!data?.length) return fail("forbidden");
  revalidatePath(`/${safeLocale(locale)}/app`, "layout");
  return { ok: true };
}

/** Erases an employee and (by cascade) their contracts, leave and findings. Owners and accountants only (RLS). */
export async function deleteEmployee(locale: string, _prev: MembersState, form: FormData): Promise<MembersState> {
  const id = uuid.safeParse(form.get("employee_id"));
  if (!id.success) return fail("invalid");
  const { supabase, user, org } = await orgSession();
  if (!user || !org || org.role === "viewer") return fail("forbidden");
  const { data, error } = await supabase.from("employees").delete().eq("id", id.data).eq("org_id", org.id).select("id");
  if (error) return fail("generic");
  if (!data?.length) return fail("forbidden");
  revalidatePath(`/${safeLocale(locale)}/app`, "layout");
  return { ok: true };
}
