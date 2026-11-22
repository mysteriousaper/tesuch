// What Tesuch actually checks: the rule list, so "Tesuch checks N areas" is never a hand-written number.
import { RULES } from "./catalog";

export type CoverageLocale = "hy" | "ru" | "en";

export function coverage(locale: CoverageLocale): { count: number; titles: string[] } {
  return { count: RULES.length, titles: RULES.map((r) => r.title[locale]) };
}

/**
 * "Rules last reviewed" date for a set of rules: the OLDEST review date (a list is only as fresh as its stalest rule),
 * or null when any rule has never been reviewed by a lawyer.
 */
export function rulesReviewedOn(rules: Pick<(typeof RULES)[number], "reviewed_on">[] = RULES): string | null {
  const dates = rules.map((r) => r.reviewed_on);
  if (dates.length === 0 || dates.some((d) => d === null)) return null;
  return (dates as string[]).sort()[0];
}
