"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Step = { kind: "email" } | { kind: "code"; email: string };

/** Email → one-time code → session. A code works on any device, unlike a PKCE link that must open in the same browser. */
export function LoginForm({ configured, linkFailed }: { configured: boolean; linkFailed: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(linkFailed ? t("linkFailed") : null);

  if (!configured) return <p className="rounded-theme border border-line bg-surface p-4 text-sm text-muted">{t("notConfigured")}</p>;

  const fail = (status?: number) => setError(status === 429 ? t("rateLimited") : t("error"));

  async function sendCode(email: string) {
    setBusy(true);
    setError(null);
    const { error: e } = await supabaseBrowser().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setBusy(false);
    if (e) return fail(e.status);
    setStep({ kind: "code", email });
  }

  async function verify(email: string, code: string) {
    setBusy(true);
    setError(null);
    const { error: e } = await supabaseBrowser().auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (e) return setError(e.status === 429 ? t("rateLimited") : t("badCode"));
    window.location.assign(`/${locale}/app`);
  }

  const input = "rounded-theme border border-control bg-surface px-3 py-2.5 text-base";
  const primary = "rounded-theme bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-60";

  return (
    <div className="flex flex-col gap-3">
      {step.kind === "email" ? (
        <form action={(f) => sendCode(String(f.get("email") ?? "").trim())} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium">{t("email")}</label>
          <input id="email" name="email" type="email" required autoComplete="email" className={input} />
          <button type="submit" disabled={busy} className={primary}>{t("send")}</button>
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
          <button type="button" disabled={busy} onClick={() => sendCode(step.email)} className="text-sm text-muted underline">
            {t("resend")}
          </button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
