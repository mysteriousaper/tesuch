"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm({ configured }: { configured: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!configured) return <p className="rounded-theme border border-line bg-surface p-4 text-sm text-muted">{t("notConfigured")}</p>;

  async function submit(form: FormData) {
    setState("sending");
    const email = String(form.get("email") ?? "").trim();
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/${locale}/app` },
    });
    setState(error ? "error" : "sent");
  }

  if (state === "sent") return <p role="status" className="rounded-theme border border-line bg-surface p-4 text-ok">{t("sent")}</p>;

  return (
    <form action={submit} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">{t("email")}</label>
      <input id="email" name="email" type="email" required autoComplete="email" className="rounded-theme border border-line bg-surface px-3 py-2.5 text-base" />
      <button type="submit" disabled={state === "sending"} className="rounded-theme bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-60">
        {t("send")}
      </button>
      {state === "error" && <p role="alert" className="text-sm text-danger">{t("error")}</p>}
    </form>
  );
}
