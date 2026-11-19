"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type { AcceptState } from "@/app/[locale]/invite/[token]/actions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { inputCls, primaryBtn } from "./forms";

export function AcceptForm({ action }: { action: (prev: AcceptState) => Promise<AcceptState> }) {
  const t = useTranslations("members.accept");
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-3" aria-busy={pending}>
      <button type="submit" disabled={pending} className={primaryBtn}>{pending ? "…" : t("button")}</button>
      {state && !state.ok && <p role="alert" className="text-sm text-danger">{t(`errors.${state.error}`)}</p>}
    </form>
  );
}

/** Email code sign-in that stays on the invite page (the address is fixed to the invited one). */
export function InviteSignIn({ email }: { email?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(address: string) {
    setBusy(true);
    setError(null);
    const { error: e } = await supabaseBrowser().auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    setBusy(false);
    if (e) return setError(e.status === 429 ? t("rateLimited") : t("error"));
    setSentTo(address);
  }

  async function verify(code: string) {
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabaseBrowser().auth.verifyOtp({ email: sentTo, token: code, type: "email" });
    setBusy(false);
    if (e) return setError(e.status === 429 ? t("rateLimited") : t("badCode"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {!sentTo ? (
        <form action={(f) => send(String(f.get("email") ?? "").trim())} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("email")}
            <input id="email" name="email" type="email" required autoComplete="email" defaultValue={email} className={inputCls} />
          </label>
          <button type="submit" disabled={busy} className={primaryBtn}>{t("send")}</button>
        </form>
      ) : (
        <form action={(f) => verify(String(f.get("code") ?? "").replace(/\s/g, ""))} className="flex flex-col gap-3">
          <p role="status" className="text-sm text-ok">{t("sent", { email: sentTo })}</p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("code")}
            <input
              id="code" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,10}" maxLength={12} autoFocus
              className={`${inputCls} text-center text-2xl tracking-[0.4em]`}
            />
          </label>
          <button type="submit" disabled={busy} className={primaryBtn}>{t("verify")}</button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
