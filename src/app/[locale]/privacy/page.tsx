import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalDocument, type LegalSection } from "@/components/legal/legal-document";
import { legalDate, legalSeo } from "@/components/legal/seo";
import { LEGAL_VERSIONS } from "@/components/legal/versions";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy.meta" });
  return legalSeo(locale, "/privacy", t("title"), t("description"));
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");
  return (
    <LegalDocument
      title={t("title")}
      intro={t("intro")}
      version={LEGAL_VERSIONS.privacy}
      updated={legalDate()}
      sections={t.raw("sections") as LegalSection[]}
      related={["terms", "dpa"]}
    />
  );
}
