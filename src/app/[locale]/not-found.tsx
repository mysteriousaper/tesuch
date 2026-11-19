import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";

/** Localized 404. Rendered for notFound() anywhere under [locale] and for unknown paths (see [...rest]). */
export default function LocaleNotFound() {
  const t = useTranslations("errors.notFound");
  const c = useTranslations("common");
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-6">
      <title>{`${t("metaTitle")} · ${c("appName")}`}</title>
      <meta name="robots" content="noindex" />
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="text-lg font-bold">{c("appName")}</Link>
        <LocaleSwitcher />
      </header>
      <section className="flex flex-1 flex-col justify-center gap-4" aria-labelledby="nf-title">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">{t("code")}</p>
        <h1 id="nf-title" className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("body")}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href="/" className="rounded-theme bg-accent px-4 py-2.5 font-semibold text-accent-ink">{t("home")}</Link>
          <Link href="/app" className="rounded-theme border border-line bg-surface px-4 py-2.5 font-semibold">{t("app")}</Link>
        </div>
      </section>
    </main>
  );
}
