import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemePreview, type PreviewFinding } from "@/components/theme-preview";
import type { Locale } from "@/i18n/routing";
import { RULES } from "@/lib/rules/catalog";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "themes" });
  return { title: t("title"), robots: { index: false } };
}

const SAMPLE: { rule: string; due: string; overdue: boolean; company: string }[] = [
  { rule: "probation-max", due: "14.11.2026", overdue: true, company: "Դեմո Լոգիստիկ ՍՊԸ" },
  { rule: "fixed-term-ending", due: "02.12.2026", overdue: false, company: "Դեմո Կլինիկա ՍՊԸ" },
  { rule: "annual-leave-min", due: "18.12.2026", overdue: false, company: "Դեմո Բեյքերի ՍՊԸ" },
];

export default async function ThemesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("themes");
  const findings: PreviewFinding[] = SAMPLE.map((s) => {
    const rule = RULES.find((r) => r.id === s.rule)!;
    return { title: rule.title[locale as Locale], article: rule.article, due: s.due, overdue: s.overdue, company: s.company };
  });
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-muted">{t("intro")}</p>
        </div>
        <LocaleSwitcher />
      </header>
      <div className="grid gap-5 lg:grid-cols-3">
        <ThemePreview theme="official" n={1} findings={findings} />
        <ThemePreview theme="fintech" n={2} findings={findings} />
        <ThemePreview theme="warm" n={3} findings={findings} />
      </div>
    </main>
  );
}
