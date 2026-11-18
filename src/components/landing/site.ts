import { routing, type Locale } from "@/i18n/routing";

/** Public base URL for canonical links, sitemap and Open Graph. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://tesuch.vercel.app").replace(/\/+$/, "");
}

const OG_LOCALE: Record<Locale, string> = { hy: "hy_AM", ru: "ru_RU", en: "en_US" };

/** Canonical + hreflang alternates + Open Graph for a public page path ("" or "/check"). */
export function pageSeo(locale: string, path: string, title: string, description: string) {
  const base = siteUrl();
  const loc = (routing.locales as readonly string[]).includes(locale) ? (locale as Locale) : routing.defaultLocale;
  const languages: Record<string, string> = Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}${path}`]));
  languages["x-default"] = `${base}/${routing.defaultLocale}${path}`;
  return {
    metadataBase: new URL(base),
    title: { absolute: title },
    description,
    alternates: { canonical: `${base}/${loc}${path}`, languages },
    openGraph: {
      type: "website" as const,
      siteName: "Tesuch · Տեսուչ",
      title,
      description,
      url: `${base}/${loc}${path}`,
      locale: OG_LOCALE[loc],
      alternateLocale: routing.locales.filter((l) => l !== loc).map((l) => OG_LOCALE[l]),
    },
    twitter: { card: "summary" as const, title, description },
  };
}
