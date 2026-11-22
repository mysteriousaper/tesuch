// What Tesuch actually checks: the rule list, so "Tesuch checks N areas" is never a hand-written number.
import { RULES } from "./catalog";

export type CoverageLocale = "hy" | "ru" | "en";

export function coverage(locale: CoverageLocale): { count: number; titles: string[] } {
  return { count: RULES.length, titles: RULES.map((r) => r.title[locale]) };
}
