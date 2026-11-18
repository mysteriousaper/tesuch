import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const c = await getTranslations("common");
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <span className="text-lg font-bold">{c("appName")}</span>
        <LocaleSwitcher />
      </header>
      <section className="flex flex-1 flex-col justify-center gap-5 py-16">
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">{t("title")}</h1>
        <p className="max-w-xl text-lg text-muted">{t("subtitle")}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/themes" className="rounded-theme bg-accent px-5 py-3 font-semibold text-accent-ink">
            {t("ctaThemes")}
          </Link>
          <span className="text-sm text-muted">{t("building")}</span>
        </div>
      </section>
    </main>
  );
}
