"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Turnstile } from "@/components/auth/turnstile";
import { classifyAuthError } from "@/lib/auth/errors";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Step = { kind: "email" } | { kind: "code"; email: string };

/** Email → one-time code → session. A code works on any device, unlike a PKCE link that must open in the same browser. */
export function LoginForm({ configured, linkFailed }: { configured: boolean; linkFailed: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(linkFailed ? t("linkFailed") : null);
  // Captcha is off unless the site key is configured; then the form behaves as before.
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const needsCaptcha = siteKey !== "" && !captchaToken;

  if (!configured) return <p className="rounded-theme border border-line bg-surface p-4 text-sm text-muted">{t("notConfigured")}</p>;

  const fail = (e: Parameters<typeof classifyAuthError>[0]) => {
    const kind = classifyAuthError(e);
    setError(kind === "rateLimited" ? t("rateLimited") : kind === "captcha" ? t("captchaFailed") : t("error"));
  };

  async function sendCode(email: string) {
    setBusy(true);
    setError(null);
    const { error: e } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, ...(siteKey && captchaToken ? { captchaToken } : {}) },
    });
    setBusy(false);
    if (siteKey) {
      setCaptchaToken(null);
      setCaptchaReset((n) => n + 1);
    }
    if (e) return fail(e);
    setStep({ kind: "code", email });
  }

  async function verify(email: string, code: string) {
    setBusy(true);
    setError(null);
    const { error: e } = await supabaseBrowser().auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (e) return setError(classifyAuthError(e) === "rateLimited" ? t("rateLimited") : t("badCode"));
    window.location.assign(`/${locale}/app`);
  }

  const input = "rounded-full border border-control bg-surface px-3 py-2.5 text-base";
  const primary = "rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-60";

  return (
    <div className="flex flex-col gap-3">
      {step.kind === "email" ? (
        <form action={(f) => sendCode(String(f.get("email") ?? "").trim())} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium">{t("email")}</label>
          <input id="email" name="email" type="email" required autoComplete="email" className={input} />
          <button type="submit" disabled={busy || needsCaptcha} className={primary}>{t("send")}</button>
        </form>
      ) : (
        <form action={(f) => verify(step.email, String(f.get("code") ?? "").replace(/\s/g, ""))} className="flex flex-col gap-3">
          <p role="status" className="text-sm text-ok">{t("sent", { email: step.email })}</p>
          <label htmlFor="code" className="text-sm font-medium">{t("code")}</label>
          <input
            id="code" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,10}" maxLength={12} autoFocus
            className={`${input} text-center text-2xl tracking-[0.4em]`}
          />
          <button type="submit" disabled={busy} className={primary}>{t("verify")}</button>
          <button type="button" disabled={busy || needsCaptcha} onClick={() => sendCode(step.email)} className="text-sm text-muted underline">
            {t("resend")}
          </button>
        </form>
      )}
      {siteKey && (
        <Turnstile
          siteKey={siteKey}
          locale={locale}
          label={t("captchaLabel")}
          resetSignal={captchaReset}
          onToken={setCaptchaToken}
          onError={() => setError(t("captchaFailed"))}
        />
      )}
      {siteKey && needsCaptcha && <p className="text-xs text-muted">{t("captchaRequired")}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
