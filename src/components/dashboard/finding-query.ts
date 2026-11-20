// Company page findings: URL filters, paging and grouping by rule (pure, unit-tested).
import type { EffectiveSeverity } from "../../lib/rules/types";

export const FINDINGS_PAGE_SIZE = 50;
export const SEVERITIES: EffectiveSeverity[] = ["red", "amber", "advisory", "info"];

export interface FindingParams { sev: EffectiveSeverity | null; q: string; page: number }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Untrusted URL input → safe filter values: unknown severity is ignored, search is trimmed and capped, page is a positive integer. */
export function parseFindingParams(sp: Record<string, string | string[] | undefined>): FindingParams {
  const sev = SEVERITIES.find((s) => s === one(sp.sev)) ?? null;
  const q = (one(sp.q) ?? "").normalize("NFC").trim().slice(0, 60);
  const n = Number.parseInt(one(sp.page) ?? "1", 10);
  return { sev, q, page: Number.isFinite(n) && n > 0 && n < 10_000 ? n : 1 };
}

/** ILIKE pattern for a name search. LIKE wildcards, backslash and PostgREST filter separators are removed, so the text is only ever a substring. */
export function likePattern(q: string): string | null {
  const clean = q.replace(/[%_\\,()*"']/g, " ").replace(/\s+/g, " ").trim();
  return clean ? `%${clean}%` : null;
}

export const pageRange = (page: number, size = FINDINGS_PAGE_SIZE) => ({ from: (page - 1) * size, to: page * size - 1 });
export const pageCount = (total: number, size = FINDINGS_PAGE_SIZE) => Math.max(1, Math.ceil(total / size));

/** Query string for a findings link; empty values are left out. */
export function findingsHref(p: Partial<FindingParams>): string {
  const sp = new URLSearchParams();
  if (p.sev) sp.set("sev", p.sev);
  if (p.q) sp.set("q", p.q);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return s ? `?${s}` : "?";
}

/** Group an already ordered list by rule, keeping the order in which each rule first appears. */
export function groupByRule<T extends { rule_id: string }>(items: T[]): { ruleId: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const i of items) groups.set(i.rule_id, [...(groups.get(i.rule_id) ?? []), i]);
  return [...groups].map(([ruleId, list]) => ({ ruleId, items: list }));
}
