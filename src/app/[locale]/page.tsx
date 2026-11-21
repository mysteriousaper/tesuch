import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HeroMock } from "@/components/landing/hero-mock";
import {
  IconArrow, IconCheck, IconCheckDoc, IconCode, IconGlobe, IconLock, IconMoon, IconScale, IconShieldCheck, IconTelegram, IconUpload,
} from "@/components/landing/icons";
import { Reveal } from "@/components/landing/reveal";
import { pageSeo } from "@/components/landing/site";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Link } from "@/i18n/navigation";
import { RULES } from "@/lib/rules/catalog";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.meta" });
  return pageSeo(locale, "", t("title"), t("description"));
}

type Step = { t: string; d: string };
type Faq = { q: string; a: string };

const STEP_ICONS = [IconUpload, IconMoon, IconCheckDoc];
const TRUST_ICONS = [IconCode, IconScale, IconShieldCheck, IconGlobe, IconLock];
const STATUS_TONES = ["var(--ok)", "var(--warn)", "var(--danger)"];

function SectionHead({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-highlight">{eyebrow}</p>
      <h2 id={id} className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h2>
    </div>
  );
}

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const steps = t.raw("how.steps") as Step[];
  const trust = t.raw("trust.items") as Step[];
  const faq = t.raw("faq.items") as Faq[];
  const statuses = t.raw("home.statuses") as Step[];
  const doneItems = t.raw("done.points") as string[];
  const codePoints = t.raw("codes.points") as string[];
  const tgLines = t.raw("owners.tgLines") as string[];
  const ruleCount = RULES.length;

  return (
    <div className="relative overflow-x-clip">
      <SiteHeader sections />

      <main>
        {/* Hero */}
        <section aria-labelledby="hero-title" className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              backgroundImage: "radial-gradient(color-mix(in oklab, var(--line) 90%, transparent) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent 75%)",
            }}
          />
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:pb-24">
            <div className="flex flex-col gap-6">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-highlight" />
                {t("hero.eyebrow")}
              </p>
              <h1 id="hero-title" className="text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl">
                {t("hero.title")}
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-muted">{t("hero.subtitle")}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/check-file"
                  className="group inline-flex items-center gap-2 rounded-theme bg-accent px-5 py-3.5 font-semibold text-accent-ink shadow-[0_12px_30px_-12px_var(--accent)] transition-transform hover:-translate-y-0.5"
                >
                  {t("hero.ctaCheck")}
                  <IconArrow width={18} height={18} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/check" className="rounded-theme border border-control bg-surface px-5 py-3.5 font-semibold transition-colors hover:bg-surface-2">
                  {t("hero.ctaQuiz")}
                </Link>
              </div>
              <p className="text-sm text-muted">{t("hero.note")}</p>
            </div>
            <HeroMock />
          </div>
        </section>

        {/* Stats */}
        <section aria-label={t("stats.rulesHint")} className="border-y border-line bg-surface">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:px-6 md:grid-cols-4">
            {[
              [t("stats.rules", { n: ruleCount }), t("stats.rulesHint")],
              [t("stats.langs"), t("stats.langsHint")],
              [t("stats.deterministic"), t("stats.deterministicHint")],
              [t("stats.eu"), t("stats.euHint")],
            ].map(([value, hint]) => (
              <div key={value} className="flex flex-col gap-1 px-2 py-6 sm:px-4">
                <dt className="order-2 text-sm text-muted">{hint}</dt>
                <dd className="order-1 text-2xl font-bold tabular-nums sm:text-3xl">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 md:py-28">
          <SectionHead id="how-title" eyebrow={t("how.eyebrow")} title={t("how.title")} />
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <li key={s.t}>
                  <Reveal delay={i * 90} className="h-full">
                    <div className="relative flex h-full flex-col gap-4 rounded-theme-lg border border-line bg-surface p-6">
                      <div className="flex items-center justify-between">
                        <span className="grid h-11 w-11 place-items-center rounded-theme bg-surface-2 text-highlight">
                          <Icon />
                        </span>
                        <span className="text-4xl font-bold tabular-nums text-line">0{i + 1}</span>
                      </div>
                      <h3 className="text-lg font-semibold">{s.t}</h3>
                      <p className="text-sm leading-relaxed text-muted">{s.d}</p>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Owner home */}
        <section id="home" aria-labelledby="home-title" className="scroll-mt-20 border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
            <SectionHead id="home-title" eyebrow={t("home.eyebrow")} title={t("home.title")} />
            <p className="-mt-6 mb-8 max-w-2xl text-lg leading-relaxed text-muted">{t("home.desc")}</p>
            <ul className="grid gap-4 sm:grid-cols-3">
              {statuses.map((st, i) => (
                <li key={st.t}>
                  <Reveal delay={i * 80} className="h-full">
                    <div className="h-full rounded-theme-lg border-2 bg-bg p-6" style={{ borderColor: STATUS_TONES[i] }}>
                      <p className="flex items-center gap-2 text-xl font-bold">
                        <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: STATUS_TONES[i] }} />
                        {st.t}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{st.d}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {(["tasks", "pack"] as const).map((k) => (
                <li key={k} className="rounded-theme-lg border border-line bg-bg p-6">
                  <h3 className="text-lg font-semibold">{t(`home.${k}.t`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{t(`home.${k}.d`)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted">{t("home.note")}</p>
          </div>
        </section>

        {/* Done for you */}
        <section id="done" aria-labelledby="done-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 md:py-28">
          <SectionHead id="done-title" eyebrow={t("done.eyebrow")} title={t("done.title")} />
          <p className="-mt-6 mb-6 max-w-2xl text-lg leading-relaxed text-muted">{t("done.desc")}</p>
          <ul className="flex max-w-3xl flex-col gap-3">
            {doneItems.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"><IconCheck width={14} height={14} /></span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <Link href="/guide" className="mt-6 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">{t("done.link")}</Link>
        </section>

        {/* Codes, not names */}
        <section id="codes" aria-labelledby="codes-title" className="scroll-mt-20 border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
            <SectionHead id="codes-title" eyebrow={t("codes.eyebrow")} title={t("codes.title")} />
            <p className="-mt-6 mb-6 max-w-2xl text-lg leading-relaxed text-muted">{t("codes.desc")}</p>
            <ul className="flex max-w-3xl flex-col gap-3">
              {codePoints.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"><IconLock width={14} height={14} /></span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-x-6">
              <Link href="/security" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">{t("codes.link")}</Link>
              <Link href="/check-file" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">{t("codes.linkCheck")}</Link>
            </div>
          </div>
        </section>

        {/* For owners */}
        <section id="owners" aria-labelledby="owners-title" className="mx-auto grid max-w-6xl scroll-mt-20 grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1">
            <figure aria-hidden className="mx-auto max-w-sm rounded-[2rem] border border-line bg-surface-2 p-3 shadow-[0_30px_70px_-35px_color-mix(in_oklab,var(--ink)_40%,transparent)]">
              <div className="flex items-center gap-3 rounded-t-[1.5rem] bg-surface px-4 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-ink"><IconTelegram width={18} height={18} /></span>
                <div>
                  <p className="text-sm font-semibold">{t("owners.tgBot")}</p>
                  <p className="text-xs text-muted">bot</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 p-3">
                <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-surface p-3.5 text-sm leading-relaxed">
                  <p className="mb-2 font-semibold">📋 {t("owners.tgTitle")}</p>
                  <ul className="flex flex-col gap-1.5">
                    {tgLines.map((l, i) => (
                      <li key={l}>{["📈", "🟡", "🟡"][i]} {l}</li>
                    ))}
                  </ul>
                  <p className="mt-2 border-t border-line pt-2 text-xs text-muted">ⓘ {t("owners.tgFooter")}</p>
                </div>
                <span className="self-end pr-1 text-[11px] text-muted">09:00</span>
              </div>
            </figure>
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <SectionHead id="owners-title" eyebrow={t("owners.eyebrow")} title={t("owners.title")} />
            <p className="-mt-4 max-w-xl text-lg leading-relaxed text-muted">{t("owners.desc")}</p>
          </Reveal>
        </section>

        {/* For accountants (short note) */}
        <section id="firms" aria-labelledby="firms-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <div className="rounded-theme-lg border border-line p-6 sm:p-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-highlight">{t("firms.eyebrow")}</p>
            <h2 id="firms-title" className="text-2xl font-bold">{t("firms.title")}</h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-muted">{t("firms.desc")}</p>
            <Link href="/guide" className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">{t("firms.link")}</Link>
          </div>
        </section>

        {/* Trust */}
        <section id="trust" aria-labelledby="trust-title" className="scroll-mt-20 border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHead id="trust-title" eyebrow={t("trust.eyebrow")} title={t("trust.title")} />
              <p className="mb-10 inline-flex items-center gap-2 rounded-full border border-advisory px-3 py-1.5 text-sm font-medium text-advisory">
                <span className="h-2 w-2 rounded-full bg-advisory" />
                {t("trust.status", { n: ruleCount })}
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trust.map((item, i) => {
                const Icon = TRUST_ICONS[i];
                return (
                  <li key={item.t} className={i === 0 ? "lg:col-span-2" : ""}>
                    <Reveal delay={i * 70} className="h-full">
                      <div className="flex h-full flex-col gap-3 rounded-theme-lg border border-line bg-bg p-6">
                        <span className="text-highlight"><Icon /></span>
                        <h3 className="text-lg font-semibold">{item.t}</h3>
                        <p className="text-sm leading-relaxed text-muted">{item.d}</p>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6 md:py-28">
          <h2 id="faq-title" className="mb-8 text-3xl font-bold sm:text-4xl">{t("faq.title")}</h2>
          <div className="flex flex-col gap-3">
            {faq.map((f, i) => (
              <details key={f.q} open={i === 0} className="group rounded-theme-lg border border-line bg-surface open:shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{f.q}</span>
                  <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-lg leading-none transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-5 leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section aria-labelledby="cta-title" className="px-4 pb-20 sm:px-6">
          <div
            className="mx-auto flex max-w-6xl flex-col items-start gap-6 overflow-hidden rounded-theme-lg bg-accent p-8 text-accent-ink sm:p-12 md:flex-row md:items-center md:justify-between"
            style={{ backgroundImage: "radial-gradient(80% 120% at 100% 0%, color-mix(in oklab, var(--accent-ink) 14%, transparent), transparent 60%)" }}
          >
            <div className="max-w-xl">
              <h2 id="cta-title" className="text-3xl font-bold leading-tight">{t("cta.title")}</h2>
              <p className="mt-3 text-lg opacity-85">{t("cta.desc")}</p>
            </div>
            <Link
              href="/check-file"
              className="inline-flex shrink-0 items-center gap-2 rounded-theme px-6 py-3.5 font-semibold transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--accent-ink)", color: "var(--accent)" }}
            >
              {t("cta.button")}
              <IconArrow width={18} height={18} />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
