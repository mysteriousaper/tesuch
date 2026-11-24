import { getTranslations } from "next-intl/server";
import { answerCodesNotice } from "@/app/[locale]/app/settings/actions";
import { primaryBtn, secondaryBtn } from "./action-form";

/** One-time owner notice for firms created before codes became the default. Rendered by the page only for owners with a pending notice. */
export async function CodesNotice({ locale }: { locale: string }) {
  const t = await getTranslations("dashboard");
  return (
    <section className="flex flex-col gap-3 glass p-4" aria-labelledby="codes-notice-h">
      <h2 id="codes-notice-h" className="text-lg font-semibold">{t("settings.codesNotice.title")}</h2>
      <p className="text-sm text-muted">{t("settings.codesNotice.body")}</p>
      <div className="flex flex-wrap gap-3">
        <form action={answerCodesNotice.bind(null, locale, true)}>
          <button type="submit" className={primaryBtn}>{t("settings.codesNotice.enable")}</button>
        </form>
        <form action={answerCodesNotice.bind(null, locale, false)}>
          <button type="submit" className={secondaryBtn}>{t("settings.codesNotice.dismiss")}</button>
        </form>
      </div>
    </section>
  );
}
