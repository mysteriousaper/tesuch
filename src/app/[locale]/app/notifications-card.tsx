"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { Locale } from "@/lib/notify/i18n";
import { connectTelegram, disconnectTelegram, sendTestAlert } from "./notify-actions";

export function NotificationsCard({ locale, linked, email }: { locale: Locale; linked: boolean; email: string | null }) {
  const t = useTranslations("notifications");
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="flex flex-col gap-4 rounded-theme-lg border border-line bg-surface p-4">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm">
          {t("telegram")}: <strong className={linked ? "text-ok" : "text-muted"}>{linked ? t("connected") : t("notConnected")}</strong>
        </span>
        {linked ? (
          <form action={disconnectTelegram.bind(null, locale)}>
            <button className="text-sm text-muted underline hover:text-ink">{t("disconnect")}</button>
          </form>
        ) : (
          <form action={connectTelegram}>
            <button className="rounded-theme bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">{t("connect")}</button>
          </form>
        )}
      </div>
      {email && <p className="text-sm text-muted">{t("email", { email })}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const sent = await sendTestAlert(locale);
          setResult(sent.length ? t("testSent", { channels: sent.join(", ") }) : t("testNone"));
        })}
        className="self-start rounded-theme border border-line px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {t("test")}
      </button>
      {result && <p role="status" className="text-sm">{result}</p>}
    </section>
  );
}
