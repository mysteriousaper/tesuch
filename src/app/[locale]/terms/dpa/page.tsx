import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { DraftBanner } from "@/components/legal/draft-banner";
import { DPA_CLAUSES, DPA_PARTIES, DPA_SIGNATURES, DPA_TITLE } from "@/components/legal/dpa-content";
import { PrintButton } from "@/components/legal/print-button";
import { legalDate, legalSeo } from "@/components/legal/seo";
import { LEGAL_VERSIONS } from "@/components/legal/versions";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.dpa.meta" });
  return legalSeo(locale, "/terms/dpa", t("title"), t("description"));
}

/** Print-friendly bilingual DPA template (English | Armenian side by side), for firm owners to sign. */
export default async function DpaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  return (
    <div className="relative overflow-x-clip print:bg-white print:text-black">
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14 print:max-w-none print:p-0">
        <DraftBanner />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl print:text-2xl">
              <span lang="hy">{DPA_TITLE.hy}</span>
              <span className="mt-1 block text-xl font-semibold text-muted sm:text-2xl print:text-lg" lang="en">{DPA_TITLE.en}</span>
            </h1>
            <p className="mt-2 text-sm text-muted">{t("updated", { version: LEGAL_VERSIONS.dpa, date: legalDate() })}</p>
          </div>
          <PrintButton label={t("dpa.print")} />
        </div>
        <p className="mt-4 max-w-3xl leading-relaxed text-muted print:hidden">{t("dpa.intro")}</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted print:hidden">{t("dpa.howTo")}</p>

        <section aria-labelledby="dpa-parties" className="mt-8 glass p-4 sm:p-5 print:border-black print:bg-white">
          <h2 id="dpa-parties" className="mb-3 font-bold">
            <span lang="hy">Կողմեր</span> · <span lang="en">Parties</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
            <p lang="en" className="leading-relaxed">{DPA_PARTIES.en}</p>
            <p lang="hy" className="leading-relaxed">{DPA_PARTIES.hy}</p>
          </div>
        </section>

        <div className="mt-6 hidden grid-cols-[2.5rem_1fr_1fr] gap-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-wide text-muted md:grid print:grid" aria-hidden="true">
          <span>#</span>
          <span>English</span>
          <span>Հայերեն</span>
        </div>
        <ol className="flex flex-col" aria-label={t("dpa.clausesLabel")}>
          {DPA_CLAUSES.map((c, i) => (
            <li key={c.title.en} className="grid gap-3 border-b border-line py-4 md:grid-cols-[2.5rem_1fr_1fr] md:gap-4 print:break-inside-avoid print:grid-cols-[2.5rem_1fr_1fr] print:border-black">
              <span className="font-bold text-muted">{i + 1}.</span>
              <div lang="en">
                <h3 className="font-semibold">{c.title.en}</h3>
                <p className="mt-1 text-sm leading-relaxed">{c.body.en}</p>
              </div>
              <div lang="hy">
                <h3 className="font-semibold">{c.title.hy}</h3>
                <p className="mt-1 text-sm leading-relaxed">{c.body.hy}</p>
              </div>
            </li>
          ))}
        </ol>

        <section aria-labelledby="dpa-signatures" className="mt-10 print:break-inside-avoid">
          <h2 id="dpa-signatures" className="mb-4 font-bold">
            <span lang="hy">Ստորագրություններ</span> · <span lang="en">Signatures</span>
          </h2>
          <div className="grid gap-6 md:grid-cols-2 print:grid-cols-2">
            {DPA_SIGNATURES.map((s) => (
              <div key={s.party.en} className="rounded-theme-lg border border-line p-4 print:border-black">
                <p className="mb-3 font-semibold">
                  <span lang="hy">{s.party.hy}</span> · <span lang="en">{s.party.en}</span>
                </p>
                <dl className="flex flex-col gap-4 text-sm">
                  {s.fields.map((f) => (
                    <div key={f.en}>
                      <dt className="text-muted">
                        <span lang="hy">{f.hy}</span> / <span lang="en">{f.en}</span>
                      </dt>
                      <dd className="mt-5 border-b border-dashed border-ink/50" aria-label={`${f.hy} / ${f.en}`}>
                        <span className="sr-only">{t("dpa.blank")}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>

        <nav aria-label={t("relatedLabel")} className="mt-12 flex flex-wrap gap-3 border-t border-line pt-6 text-sm print:hidden">
          <Link href="/terms" className="rounded-full border border-control px-3 py-2 text-muted hover:text-ink">{t("related.terms")}</Link>
          <Link href="/privacy" className="rounded-full border border-control px-3 py-2 text-muted hover:text-ink">{t("related.privacy")}</Link>
        </nav>
      </main>
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </div>
  );
}
