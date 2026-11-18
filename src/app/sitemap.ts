import type { MetadataRoute } from "next";
import { siteUrl } from "@/components/landing/site";
import { routing } from "@/i18n/routing";

const PUBLIC_PATHS = ["", "/check"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.8,
      alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}${path}`])) },
    })),
  );
}
