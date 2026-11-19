"use server";

import { cookies } from "next/headers";
import { ORG_COOKIE } from "@/components/dashboard/queries";
import { acceptErrorKey, TOKEN_RE, type AcceptError } from "@/components/members/lib";
import { redirect } from "@/i18n/navigation";
import { supabaseForUser } from "@/lib/supabase/server";

export type AcceptState = { ok: false; error: AcceptError | "signIn" } | null;

/** Accepts through the security definer RPC (it checks token, expiry, single use and email), then opens the new org. */
export async function acceptInvite(locale: string, token: string): Promise<AcceptState> {
  if (!TOKEN_RE.test(token)) return { ok: false, error: "notFound" };
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "signIn" };
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !data) return { ok: false, error: acceptErrorKey(error?.message) };
  (await cookies()).set(ORG_COOKIE, data as string, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  return redirect({ href: "/app", locale: ["hy", "ru", "en"].includes(locale) ? locale : "hy" });
}
