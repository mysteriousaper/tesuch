import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PrintButton } from "@/components/guide/print-button";
import { BOT_COMMANDS, STEP_SHOTS } from "@/components/guide/shots";
import { pageSeo, siteUrl } from "@/components/landing/site";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Cards as FactCards } from "@/components/trust/cards";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guide.meta" });
  return pageSeo(locale, "/guide", t("title"), t("description"));
}

type Item = { t: string; d: string };
type Step = Item & { alts: string[] };
type Faq = { q: string; a: string };

const SECTIONS = ["done", "why", "gain", "how", "limits", "faq"] as const;
const btn = "inline-flex min-h-11 items-center justify-center rounded-theme px-5 text-sm font-semibold motion-reduce:transition-none print:hidden";

function Eyebrow({ children }: { children: string }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-highlight">{children}</p>;
}

function Cards({ items }: { items: Item[] }) {
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {items.map((i) => (
        <li key={i.t} className="break-inside-avoid glass p-4">
          <h4 className="font-semibold">{i.t}</h4>
          <p className="mt-1 text-sm leading-relaxed text-muted">{i.d}</p>
        </li>
      ))}
    </ul>
  );
}

export default async function GuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("guide");
  const c = await getTranslations("common");
  const done = t.raw("done.items") as Item[];
  const problems = t.raw("why.problems") as Item[];
  const firm = t.raw("gain.firm") as Item[];
  const owner = t.raw("gain.owner") as Item[];
  const steps = t.raw("how.steps") as Step[];
  const limits = t.raw("limits.items") as Item[];
  const faq = t.raw("faq.items") as Faq[];

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <div className="relative overflow-x-clip">
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />

      <main className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14 print:max-w-none print:px-0 print:pb-0 print:pt-0">
        <header>
          <p className="mb-3 hidden text-lg font-bold print:block">{c("appName")}</p>
          <Eyebrow>{t("hero.eyebrow")}</Eyebrow>
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl" style={{ letterSpacing: "var(--heading-tracking)" }}>
            {t("hero.title")}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{t("hero.subtitle")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/check" className={`${btn} bg-accent text-accent-ink transition-transform hover:-translate-y-px`}>
              {t("hero.ctaCheck")}
            </Link>
            <Link href="/login" className={`${btn} border border-line bg-surface text-ink hover:bg-surface-2`}>
              {t("hero.ctaLogin")}
            </Link>
            <PrintButton label={t("hero.print")} />
          </div>
          <p className="mt-3 text-sm text-muted print:hidden">{t("hero.printHint")}</p>
          <p className="mt-1 text-sm text-muted">{t("hero.demoNote")}</p>
        </header>

        <nav aria-label={t("toc")} className="mt-8 glass p-4 print:hidden">
          <p className="mb-2 text-sm font-semibold">{t("toc")}</p>
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

        <section id="done" aria-labelledby="done-h" className="mt-14 scroll-mt-24">
          <div className="rounded-theme-lg border-l-4 border-highlight bg-surface p-5 sm:p-6">
            <h2 id="done-h" className="text-2xl font-bold sm:text-3xl">{t("done.title")}</h2>
            <p className="mt-2 text-muted">{t("done.intro")}</p>
            <FactCards items={done} />
            <p className="mt-4 leading-relaxed">{t("done.note")}</p>
            <p className="mt-3">
              <Link href="/security" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 print:hidden">
                {t("done.securityLink")}
              </Link>
            </p>
          </div>
        </section>

        <section id="why" aria-labelledby="why-h" className="mt-14 scroll-mt-24">
          <h2 id="why-h" className="text-2xl font-bold sm:text-3xl">{t("why.title")}</h2>
          <p className="mt-3 max-w-3xl leading-relaxed">{t("why.intro")}</p>
          <h3 className="mt-8 text-lg font-semibold">{t("why.problemsTitle")}</h3>
          <p className="mt-1 text-sm text-muted">{t("why.problemsNote")}</p>
          <Cards items={problems} />
          <div className="mt-8 break-inside-avoid rounded-theme-lg border-l-4 border-highlight bg-surface p-5">
            <h3 className="text-lg font-semibold">{t("why.costTitle")}</h3>
            <p className="mt-2 leading-relaxed">{t("why.cost")}</p>
          </div>
        </section>

        <section id="gain" aria-labelledby="gain-h" className="mt-14 scroll-mt-24">
          <h2 id="gain-h" className="text-2xl font-bold sm:text-3xl">{t("gain.title")}</h2>
          <h3 className="mt-6 text-lg font-semibold">{t("gain.ownerTitle")}</h3>
          <p className="mt-1 text-muted">{t("gain.ownerIntro")}</p>
          <Cards items={owner} />
          <h3 className="mt-10 text-lg font-semibold">{t("gain.firmTitle")}</h3>
          <p className="mt-1 text-muted">{t("gain.firmIntro")}</p>
          <Cards items={firm} />
        </section>

        <section id="how" aria-labelledby="how-h" className="mt-14 scroll-mt-24">
          <h2 id="how-h" className="text-2xl font-bold sm:text-3xl">{t("how.title")}</h2>
          <p className="mt-3 max-w-3xl text-muted">{t("how.intro")}</p>
          <ol className="mt-8 flex flex-col gap-10">
            {steps.map((s, i) => (
              <li key={s.t} className="flex gap-3 sm:gap-5">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t("how.stepLabel", { n: i + 1 })}</p>
                  <h3 className="text-xl font-bold">{s.t}</h3>
                  <p className="mt-2 max-w-3xl leading-relaxed">{s.d}</p>
                  {i === 6 && (
                    <dl aria-label={t("botCommands.label")} className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                      {BOT_COMMANDS.map((b) => (
                        <div key={b.cmd} className="contents">
                          <dt>
                            <code className="rounded-theme bg-surface-2 px-2 py-1 font-mono text-[0.85rem]">{b.cmd}</code>
                          </dt>
                          <dd className="text-muted">{t(`botCommands.${b.key}`)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="mt-4 flex flex-col gap-4">
                    {STEP_SHOTS[i].map((shot, k) => (
                      <Image
                        key={shot.src}
                        src={shot.src}
                        alt={s.alts[k]}
                        width={shot.width}
                        height={shot.height}
                        unoptimized
                        loading="lazy"
                        sizes="(min-width: 896px) 800px, 100vw"
                        className="h-auto w-full break-inside-avoid rounded-theme-lg border border-line print:max-h-[85mm] print:w-auto"
                        style={{ maxWidth: Math.min(shot.width, 800) }}
                      />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="limits" aria-labelledby="limits-h" className="mt-14 scroll-mt-24">
          <div className="rounded-theme-lg border border-advisory bg-surface p-5 sm:p-6">
            <h2 id="limits-h" className="text-2xl font-bold sm:text-3xl">{t("limits.title")}</h2>
            <p className="mt-2 text-muted">{t("limits.intro")}</p>
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

        <section id="faq" aria-labelledby="faq-h" className="mt-14 scroll-mt-24">
          <h2 id="faq-h" className="text-2xl font-bold sm:text-3xl">{t("faq.title")}</h2>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {faq.map((f) => (
              <div key={f.q} className="break-inside-avoid py-4">
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-1 leading-relaxed text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="cta-h" className="mt-14 break-inside-avoid glass-2 p-6 sm:p-8">
          <h2 id="cta-h" className="text-2xl font-bold">{t("cta.title")}</h2>
          <p className="mt-2 max-w-2xl leading-relaxed text-muted">{t("cta.text")}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/check" className={`${btn} bg-accent text-accent-ink transition-transform hover:-translate-y-px`}>
              {t("cta.check")}
            </Link>
            <Link href="/login" className={`${btn} border border-line bg-surface text-ink hover:bg-surface-2`}>
              {t("cta.login")}
            </Link>
          </div>
          <p className="mt-4 hidden text-sm print:block">
            {siteUrl()}/{locale}/check · {siteUrl()}/{locale}/login
          </p>
        </section>
      </main>

      <div className="print:hidden">
        <SiteFooter />
      </div>
    </div>
  );
}
