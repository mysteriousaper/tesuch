"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { startTransition, useEffect } from "react";
import { Link } from "@/i18n/navigation";

/**
 * Error boundary for every page under [locale] (and, re-exported, inside the /app shell).
 * Never renders error.message or a stack: in production Next already redacts server errors, and client
 * errors may carry data. Only the digest (an opaque id that matches the server log line) is shown and logged.
 */
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors.boundary");
  const router = useRouter();

  useEffect(() => {
    console.error(`[tesuch] page error${error.digest ? ` digest=${error.digest}` : ""}`);
  }, [error.digest]);

  // Server component errors need fresh RSC data, not just a client re-render.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <section role="alert" aria-labelledby="err-title" className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
      <h1 id="err-title" className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted">{t("body")}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={retry} className="rounded-theme bg-accent px-4 py-2.5 font-semibold text-accent-ink">
          {t("retry")}
        </button>
        <Link href="/" className="rounded-theme border border-control bg-surface px-4 py-2.5 font-semibold">{t("home")}</Link>
      </div>
      {error.digest && (
        <p className="text-sm text-muted">
          {t("reference", { digest: error.digest })} <br />
          {t("referenceHint")}
        </p>
      )}
    </section>
  );
}
