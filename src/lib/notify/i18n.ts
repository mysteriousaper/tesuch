// Shared, user-facing strings for alerts, digests and PDFs. Armenian is the default locale.
import { RULES } from "../rules/catalog";
import { rulesReviewedOn } from "../rules/coverage";
import type { RuleDefinition } from "../rules/schema";
import type { EffectiveSeverity, IsoDate } from "../rules/types";

export type Locale = "hy" | "ru" | "en";
export const LOCALES: Locale[] = ["hy", "ru", "en"];

export const SEVERITY_LABEL: Record<Locale, Record<EffectiveSeverity, string>> = {
  hy: { red: "Խախտում", amber: "Ռիսկ", advisory: "Նախազգուշական", info: "Հիշեցում" },
  ru: { red: "Нарушение", amber: "Риск", advisory: "Рекомендация", info: "Напоминание" },
  en: { red: "Violation", amber: "Risk", advisory: "Advisory", info: "Reminder" },
};

export const DISCLAIMER: Record<Locale, string> = {
  hy: "Սա իրավաբանական խորհրդատվություն չէ։ Կանոնները դեռ ստուգվում են իրավաբանի կողմից։",
  ru: "Это не юридическая консультация. Правила ещё проверяются юристом.",
  en: "This is not legal advice. The rules are still being reviewed by a lawyer.",
};

const ARTICLE: Record<Locale, (n: string) => string> = {
  hy: (n) => `ՀՀ աշխատանքային օրենսգիրք, հոդված ${n}`,
  ru: (n) => `ТК РА, ст. ${n}`,
  en: (n) => `RA Labour Code, Art. ${n}`,
};

const ARTICLE_PENDING: Record<Locale, string> = {
  hy: "հոդվածը ճշտվում է իրավաբանի հետ",
  ru: "статья уточняется у юриста",
  en: "article pending lawyer review",
};

const UNVERIFIED_SUFFIX: Record<Locale, string> = {
  hy: " (ենթակա է իրավաբանի ստուգման)",
  ru: " (требует проверки юристом)",
  en: " (subject to lawyer review)",
};

/** One line for every alert, digest and PDF: what Tesuch covers, and that a clean result is not a guarantee. */
export function coverageLine(locale: Locale): string {
  const n = RULES.length;
  return {
    hy: `Տեսուչը ստուգում է ${n} ոլորտ։ Սա տեսչության արդյունքի երաշխիք չէ։`,
    ru: `Тесуч проверяет областей: ${n}. Это не гарантия результата проверки.`,
    en: `Tesuch checks ${n} areas. Not a guarantee of the inspection result.`,
  }[locale];
}

/** "Rules last reviewed: <date>", or an honest "not yet reviewed by a lawyer" while no date is recorded in rules/*.json. */
export function rulesReviewedLine(locale: Locale): string {
  const d = rulesReviewedOn();
  if (d === null) return { hy: "Կանոնները դեռ չեն ստուգվել իրավաբանի կողմից", ru: "Правила ещё не проверены юристом", en: "Rules not yet reviewed by a lawyer" }[locale];
  const date = formatDate(d);
  return { hy: `Կանոնների վերջին ստուգումը՝ ${date}`, ru: `Правила проверены юристом: ${date}`, en: `Rules last reviewed: ${date}` }[locale];
}

export const T = {
  due: { hy: "Ժամկետ", ru: "Срок", en: "Due" },
  overdue: { hy: "ժամկետանց", ru: "просрочено", en: "overdue" },
  employee: { hy: "Աշխատող", ru: "Сотрудник", en: "Employee" },
  company: { hy: "Ընկերություն", ru: "Компания", en: "Company" },
  score: { hy: "Պատրաստվածության միավոր", ru: "Балл готовности", en: "Inspection-Ready Score" },
  noScore: { hy: "Տվյալներ դեռ չկան", ru: "Данных пока нет", en: "No data yet" },
  alertSubject: { hy: "Նոր ահազանգ", ru: "Новое оповещение", en: "New alert" },
  digestTitle: { hy: "Շաբաթական ամփոփում", ru: "Еженедельная сводка", en: "Weekly digest" },
  openFindings: { hy: "Բաց հարցեր", ru: "Открытые замечания", en: "Open findings" },
  noFindings: { hy: "Բաց հարցեր չկան։ Այդպես շարունակեք։", ru: "Открытых замечаний нет. Так держать!", en: "No open findings. Keep it up!" },
  andMore: { hy: (n: number) => `և ևս ${n}`, ru: (n: number) => `и ещё ${n}`, en: (n: number) => `and ${n} more` },
  source: { hy: "Աղբյուր", ru: "Источник", en: "Source" },
} as const;

/** Citation line. Never invents an article: null article → "pending lawyer review". */
export function citation(rule: Pick<RuleDefinition, "article" | "status">, locale: Locale): string {
  if (!rule.article) return ARTICLE_PENDING[locale];
  return ARTICLE[locale](rule.article) + (rule.status === "verified" ? "" : UNVERIFIED_SUFFIX[locale]);
}

const RULES_BY_ID = new Map(RULES.map((r) => [r.id, r]));

export function ruleById(id: string): RuleDefinition {
  const r = RULES_BY_ID.get(id);
  if (!r) throw new Error(`Unknown rule: ${id}`);
  return r;
}

/** 2026-04-15 → 15.04.2026 (the format used in Armenian and Russian paperwork). */
export function formatDate(iso: IsoDate): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
