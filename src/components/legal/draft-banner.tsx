import { getTranslations } from "next-intl/server";

/** Prominent notice on every legal text: these are drafts pending a licensed Armenian lawyer. Also printed. */
export async function DraftBanner() {
  const t = await getTranslations("legal.banner");
  return (
    <aside
      role="note"
      aria-label={t("title")}
      data-testid="legal-draft-banner"
      className="mb-8 rounded-theme-lg border-2 border-warn px-4 py-3 sm:px-5 sm:py-4 print:mb-4 print:border-black"
      style={{ background: "color-mix(in oklab, var(--warn) 10%, var(--surface))" }}
    >
      <p className="flex items-center gap-2 font-bold text-warn print:text-black">
        <span aria-hidden="true">⚠</span>
        {t("title")}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ink">{t("body")}</p>
    </aside>
  );
}
