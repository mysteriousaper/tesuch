import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageSeo } from "@/components/landing/site";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { FileCheck } from "./file-check";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkfile.meta" });
  return pageSeo(locale, "/check-file", t("title"), t("description"));
}

export default async function CheckFilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("checkfile");
  return (
    <div className="relative overflow-x-clip">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-highlight">{t("eyebrow")}</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{t("title")}</h1>
        <p className="mb-6 mt-3 max-w-2xl text-lg leading-relaxed text-muted">{t("intro")}</p>
        <FileCheck locale={locale as "hy" | "ru" | "en"} />
      </main>
      <SiteFooter />
    </div>
  );
}
