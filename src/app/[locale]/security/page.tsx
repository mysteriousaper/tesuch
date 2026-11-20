import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { pageSeo } from "@/components/landing/site";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Cards, type Item } from "@/components/trust/cards";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trust.meta" });
  return pageSeo(locale, "/security", t("title"), t("description"));
}

type Processor = { name: string; role: string; data: string };

const SECTIONS = ["facts", "processors", "limits", "start"] as const;
// Where each "start without risk" step leads (index matches trust.start.items); null = no link.
const START_LINKS = ["/check", "/login", null, "/terms/dpa"] as const;
const SOON_INDEX = 2;
const REGION = "eu-west-1"; // Supabase project region (docs/DECISIONS.md #16)
const btn = "inline-flex min-h-11 items-center justify-center rounded-theme px-5 text-sm font-semibold motion-reduce:transition-none";

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("trust");
  const facts = t.raw("facts.items") as Item[];
  const processors = t.raw("processors.items") as Processor[];
  const limits = t.raw("limits.items") as Item[];
  const start = t.raw("start.items") as Item[];

  return (
    <div className="relative overflow-x-clip">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-highlight">{t("hero.eyebrow")}</p>
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl" style={{ letterSpacing: "var(--heading-tracking)" }}>
            {t("hero.title")}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{t("hero.subtitle")}</p>
        </header>

        <nav aria-label={t("hero.eyebrow")} className="mt-8 rounded-theme-lg border border-line bg-surface p-4">
          <ul className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <li key={s}>
                <a href={`#${s}`} className="inline-flex min-h-11 items-center rounded-theme border border-line px-3.5 text-sm text-muted hover:text-ink">
                  {t(`nav.${s}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section id="facts" aria-labelledby="facts-h" className="mt-14 scroll-mt-24">
          <h2 id="facts-h" className="text-2xl font-bold sm:text-3xl">{t("facts.title")}</h2>
          <Cards items={facts} />
          <p className="mt-3 text-sm text-muted">
            {t("facts.regionLabel")} <code className="rounded-theme bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85rem]">{REGION}</code>
          </p>
        </section>

        <section id="processors" aria-labelledby="processors-h" className="mt-14 scroll-mt-24">
          <h2 id="processors-h" className="text-2xl font-bold sm:text-3xl">{t("processors.title")}</h2>
          <p className="mt-3 max-w-3xl text-muted">{t("processors.intro")}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {processors.map((p) => (
              <li key={p.name} className="rounded-theme-lg border border-line bg-surface p-4">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-sm text-muted">{p.role}</p>
                <p className="mt-2 text-sm leading-relaxed">
                  <span className="font-semibold">{t("processors.dataLabel")}: </span>
                  {p.data}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">{t("processors.note")}</p>
          <p className="mt-3">
            <Link href="/terms/dpa" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              {t("processors.dpa")}
            </Link>
          </p>
        </section>

        <section id="limits" aria-labelledby="limits-h" className="mt-14 scroll-mt-24">
          <div className="rounded-theme-lg border border-advisory bg-surface p-5 sm:p-6">
            <h2 id="limits-h" className="text-2xl font-bold sm:text-3xl">{t("limits.title")}</h2>
            <ul className="mt-4 flex flex-col gap-4">
              {limits.map((l) => (
                <li key={l.t}>
                  <h3 className="font-semibold">{l.t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{l.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="start" aria-labelledby="start-h" className="mt-14 scroll-mt-24">
          <h2 id="start-h" className="text-2xl font-bold sm:text-3xl">{t("start.title")}</h2>
          <p className="mt-3 max-w-3xl text-muted">{t("start.intro")}</p>
          <ol className="mt-6 flex flex-col gap-4">
            {start.map((s, i) => (
              <li key={s.t} className="flex gap-3 sm:gap-4">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold">{s.t}</h3>
                  {i === SOON_INDEX && (
                    <p className="mt-1 inline-block rounded-theme border border-advisory px-2 py-0.5 text-xs font-semibold">{t("start.soon")}</p>
                  )}
                  <p className="mt-1 max-w-3xl leading-relaxed text-muted">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={START_LINKS[0]} className={`${btn} bg-accent text-accent-ink transition-transform hover:-translate-y-px`}>
              {t("start.ctaCheck")}
            </Link>
            <Link href={START_LINKS[1]} className={`${btn} border border-line bg-surface text-ink hover:bg-surface-2`}>
              {t("start.ctaLogin")}
            </Link>
            <Link href={START_LINKS[3]} className={`${btn} border border-line bg-surface text-ink hover:bg-surface-2`}>
              {t("start.ctaDpa")}
            </Link>
          </div>
          <p className="mt-6">
            <Link href="/guide" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              {t("start.guide")}
            </Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
