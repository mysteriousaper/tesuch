import { getTranslations } from "next-intl/server";

// Placeholder: owned by a feature team.
export default async function Page() {
  const t = await getTranslations("app");
  return <p className="text-muted">{t("comingSoon")}</p>;
}
