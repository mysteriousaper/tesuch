import type { Metadata } from "next";
import { pageSeo } from "@/components/landing/site";
import { LEGAL_UPDATED_ON } from "./versions";

/** Public SEO for a legal page, kept out of search indexes while the texts are drafts. */
export function legalSeo(locale: string, path: string, title: string, description: string): Metadata {
  return { ...pageSeo(locale, path, title, description), robots: { index: false, follow: true } };
}

/** "19.11.2026": the Armenian/Russian convention, also unambiguous in English. */
export function legalDate(iso = LEGAL_UPDATED_ON): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
