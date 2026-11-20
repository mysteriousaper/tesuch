export type AuthErrorKind = "rateLimited" | "captcha" | "generic";

type ErrorLike = { status?: number; code?: string; message?: string } | null | undefined;

/** Map a Supabase auth error to a user-facing message key. */
export function classifyAuthError(e: ErrorLike): AuthErrorKind {
  if (!e) return "generic";
  const msg = (e.message ?? "").toLowerCase();
  const code = (e.code ?? "").toLowerCase();
  if (e.status === 429 || code.includes("rate_limit") || msg.includes("rate limit") || msg.includes("too many")) return "rateLimited";
  if (code.includes("captcha") || msg.includes("captcha")) return "captcha";
  return "generic";
}
