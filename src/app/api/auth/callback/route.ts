import { NextResponse } from "next/server";
import { supabaseForUser } from "@/lib/supabase/server";

/** Magic-link landing: exchange the one-time code for a session cookie. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/hy/app";
  // Only allow same-site relative redirects (no open redirect).
  const next = /^\/(hy|ru|en)\/[a-z/-]*$/.test(nextParam) ? nextParam : "/hy/app";
  if (code) {
    const supabase = await supabaseForUser();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL(`${next.slice(0, 3)}/login?error=1`, url.origin));
}
