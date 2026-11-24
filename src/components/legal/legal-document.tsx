import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Link } from "@/i18n/navigation";
import { DraftBanner } from "./draft-banner";

/** One section of a legal text, as stored in messages/<locale>/{legal,privacy}.json. */
export interface LegalSection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
  after?: string[];
}

type Related = "privacy" | "terms" | "dpa";
const HREF: Record<Related, string> = { privacy: "/privacy", terms: "/terms", dpa: "/terms/dpa" };

/** Public page shell for a long legal text: site header, draft banner, table of contents, numbered sections. */
export async function LegalDocument({
  title,
  intro,
  version,
  updated,
  sections,
  related,
}: {
  title: string;
  intro: string;
  version: string;
  updated: string;
  sections: LegalSection[];
  related: Related[];
}) {
  const t = await getTranslations("legal");
  return (
    <div className="relative overflow-x-clip">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <DraftBanner />
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">{t("updated", { version, date: updated })}</p>
        <p className="mt-4 text-lg leading-relaxed text-muted">{intro}</p>

        <nav aria-label={t("toc")} className="mt-8 glass p-4 sm:p-5">
          <p className="mb-2 text-sm font-semibold">{t("toc")}</p>
          <ol className="list-decimal pl-5 text-sm sm:columns-2 sm:gap-x-12">
            {sections.map((s) => (
              <li key={s.id} className="mb-1 break-inside-avoid">
                <a href={`#${s.id}`} className="text-muted underline-offset-2 hover:text-ink hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 flex flex-col gap-9">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
              <h2 id={`${s.id}-h`} className="text-xl font-bold">
                <span className="mr-2 text-muted">{i + 1}.</span>
                {s.title}
              </h2>
              {s.paragraphs?.map((p, j) => (
                <p key={j} className="mt-3 leading-relaxed">{p}</p>
              ))}
              {s.items && (
                <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 leading-relaxed marker:text-muted">
                  {s.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              )}
              {s.after?.map((p, j) => (
                <p key={j} className="mt-3 leading-relaxed text-muted">{p}</p>
              ))}
            </section>
          ))}
        </div>

        <nav aria-label={t("relatedLabel")} className="mt-12 flex flex-wrap gap-3 border-t border-line pt-6 text-sm">
          {related.map((r) => (
            <Link key={r} href={HREF[r]} className="rounded-full border border-control px-3 py-2 text-muted hover:text-ink">
              {t(`related.${r}`)}
            </Link>
          ))}
        </nav>
      </main>
      <SiteFooter />
    </div>
  );
}
