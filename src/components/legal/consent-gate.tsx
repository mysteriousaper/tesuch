"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { recordConsent } from "./actions";

/**
 * Asks a signed-in user to accept the current Terms and Privacy notice (checkbox not pre-ticked),
 * records it with recordConsent, then continues to /app.
 */
export function ConsentGate({ next = "/app" }: { next?: string }) {
  const t = useTranslations("legal.consent");
  const locale = useLocale() as "hy" | "ru" | "en";
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!checked) return setError(t("errorUnchecked"));
    setError(null);
    start(async () => {
      const res = await recordConsent({ locale, accepted: true });
      if (res.ok) router.replace(next);
      else if (res.error === "forbidden") router.replace("/login");
      else setError(t("error"));
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" data-testid="consent-gate">
      <ul className="flex flex-col gap-2 glass p-4 text-sm leading-relaxed sm:p-5">
        {(t.raw("points") as string[]).map((p) => (
          <li key={p} className="flex gap-2">
            <span aria-hidden="true" className="text-ok">✓</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/terms" target="_blank" className="font-medium text-highlight underline underline-offset-2">{t("readTerms")}</Link>
        <Link href="/privacy" target="_blank" className="font-medium text-highlight underline underline-offset-2">{t("readPrivacy")}</Link>
      </div>
      <label className="flex items-start gap-3 text-sm leading-relaxed">
        <input
          id="consent-accept"
          name="accept"
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          aria-describedby={error ? "consent-error" : undefined}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
        />
        <span>{t("checkbox")}</span>
      </label>
      {error && (
        <p id="consent-error" role="alert" className="text-sm font-medium text-danger">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-4 py-3 font-semibold text-accent-ink transition-opacity disabled:opacity-60 sm:self-start"
      >
        {pending ? t("saving") : t("submit")}
      </button>
    </form>
  );
}
