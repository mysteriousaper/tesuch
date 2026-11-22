// Builds Telegram and email messages from findings. Pure: no network, no clock.
import type { EffectiveSeverity, Finding } from "../rules/types";
import { citation, coverageLine, DISCLAIMER, escapeHtml, formatDate, ruleById, SEVERITY_LABEL, T, type Locale } from "./i18n";

export interface AlertItem {
  finding: Finding;
  companyName: string;
  employeeName: string;
}

export interface DigestCompany {
  companyName: string;
  score: number;
  /** Open findings for this company. */
  items: AlertItem[];
}

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

/** Telegram's hard limit for one message. */
export const TELEGRAM_MAX = 4096;
const DIGEST_ITEMS_PER_COMPANY = 3;

const SEVERITY_ORDER: Record<EffectiveSeverity, number> = { red: 0, amber: 1, advisory: 2, info: 3 };
const ICON: Record<EffectiveSeverity, string> = { red: "🔴", amber: "🟠", advisory: "🟡", info: "🔵" };

export function sortItems(items: AlertItem[]): AlertItem[] {
  return [...items].sort(
    (a, b) =>
      Number(b.finding.overdue) - Number(a.finding.overdue) ||
      SEVERITY_ORDER[a.finding.severity] - SEVERITY_ORDER[b.finding.severity] ||
      a.finding.dueDate.localeCompare(b.finding.dueDate),
  );
}

const needsDisclaimer = (items: AlertItem[]) => items.some((i) => i.finding.severity === "advisory" || i.finding.ruleStatus !== "verified");

interface Line {
  icon: string;
  severity: string;
  title: string;
  who: string;
  due: string;
  cite: string;
  url: string;
}

function line(item: AlertItem, locale: Locale): Line {
  const f = item.finding;
  const rule = ruleById(f.ruleId);
  return {
    icon: ICON[f.severity],
    severity: SEVERITY_LABEL[locale][f.severity],
    title: rule.title[locale],
    who: `${item.companyName} · ${item.employeeName}`,
    due: `${T.due[locale]}: ${formatDate(f.dueDate)}${f.overdue ? ` (${T.overdue[locale]})` : ""}`,
    cite: citation(rule, locale),
    url: f.sourceUrl,
  };
}

// ---------- Telegram (parse_mode=HTML) ----------

function telegramItem(item: AlertItem, locale: Locale): string {
  const l = line(item, locale);
  return [
    `${l.icon} <b>${escapeHtml(l.severity)}:</b> ${escapeHtml(l.title)}`,
    escapeHtml(l.who),
    escapeHtml(l.due),
    `${escapeHtml(l.cite)} · <a href="${escapeHtml(l.url)}">arlis.am</a>`,
  ].join("\n");
}

export function telegramAlert(item: AlertItem, locale: Locale): string {
  const parts = [`🔔 <b>Tesuch · ${escapeHtml(T.alertSubject[locale])}</b>`, telegramItem(item, locale)];
  if (needsDisclaimer([item])) parts.push(`<i>${escapeHtml(DISCLAIMER[locale])}</i>`);
  return parts.join("\n\n");
}

export function telegramDigest(companies: DigestCompany[], locale: Locale): string {
  const all = companies.flatMap((c) => c.items);
  const footer = (needsDisclaimer(all) ? `\n\n<i>${escapeHtml(DISCLAIMER[locale])}</i>` : "") + `\n\n<i>${escapeHtml(coverageLine(locale))}</i>`;
  const header = `📋 <b>Tesuch · ${escapeHtml(T.digestTitle[locale])}</b>`;
  const blocks = [...companies]
    .sort((a, b) => a.score - b.score)
    .map((c) => {
      const items = sortItems(c.items);
      const shown = items.slice(0, DIGEST_ITEMS_PER_COMPANY).map((i) => telegramItem(i, locale));
      const rest = items.length - shown.length;
      const head = `<b>${escapeHtml(c.companyName)}</b> — ${escapeHtml(T.score[locale])}: <b>${c.score}</b>/100`;
      if (items.length === 0) return `${head}\n✅ ${escapeHtml(T.noFindings[locale])}`;
      return [head, ...shown, ...(rest > 0 ? [`… ${escapeHtml(T.andMore[locale](rest))}`] : [])].join("\n\n");
    });

  // Fit Telegram's limit by dropping whole company blocks, never cutting HTML mid-tag.
  let body = "";
  let omitted = 0;
  for (const [i, b] of blocks.entries()) {
    const candidate = `${body}\n\n${b}`;
    if ((header + candidate + footer).length + 40 > TELEGRAM_MAX) {
      omitted = blocks.length - i;
      break;
    }
    body = candidate;
  }
  const more = omitted > 0 ? `\n\n… ${escapeHtml(T.andMore[locale](omitted))}` : "";
  return header + body + more + footer;
}

// ---------- Email ----------

const wrap = (inner: string, locale: Locale) =>
  `<!doctype html><html lang="${locale}"><body style="font-family:'Noto Sans Armenian','Noto Sans',Arial,sans-serif;color:#1a1a1a;line-height:1.5;max-width:640px;margin:0 auto;padding:16px">${inner}</body></html>`;

function emailItemHtml(item: AlertItem, locale: Locale): string {
  const l = line(item, locale);
  return `<div style="border-left:4px solid #999;padding:4px 12px;margin:12px 0"><strong>${escapeHtml(l.severity)}:</strong> ${escapeHtml(l.title)}<br>${escapeHtml(l.who)}<br>${escapeHtml(l.due)}<br><small>${escapeHtml(l.cite)} · <a href="${escapeHtml(l.url)}">arlis.am</a></small></div>`;
}

function emailItemText(item: AlertItem, locale: Locale): string {
  const l = line(item, locale);
  return `${l.severity}: ${l.title}\n${l.who}\n${l.due}\n${l.cite} · ${l.url}`;
}

export function emailAlert(item: AlertItem, locale: Locale): EmailMessage {
  const title = ruleById(item.finding.ruleId).title[locale];
  const disclaimer = needsDisclaimer([item]);
  return {
    subject: `Tesuch · ${T.alertSubject[locale]}: ${item.companyName} — ${title}`,
    html: wrap(
      `<h2>${escapeHtml(T.alertSubject[locale])}</h2>${emailItemHtml(item, locale)}${disclaimer ? `<p><em>${escapeHtml(DISCLAIMER[locale])}</em></p>` : ""}`,
      locale,
    ),
    text: [emailItemText(item, locale), ...(disclaimer ? ["", DISCLAIMER[locale]] : [])].join("\n"),
  };
}

export function emailDigest(companies: DigestCompany[], locale: Locale): EmailMessage {
  const sorted = [...companies].sort((a, b) => a.score - b.score);
  const all = sorted.flatMap((c) => c.items);
  const disclaimer = needsDisclaimer(all);
  const htmlBlocks = sorted.map((c) => {
    const items = sortItems(c.items);
    const body = items.length ? items.map((i) => emailItemHtml(i, locale)).join("") : `<p>✅ ${escapeHtml(T.noFindings[locale])}</p>`;
    return `<h3>${escapeHtml(c.companyName)} — ${escapeHtml(T.score[locale])}: ${c.score}/100</h3>${body}`;
  });
  const textBlocks = sorted.map((c) => {
    const items = sortItems(c.items);
    const body = items.length ? items.map((i) => emailItemText(i, locale)).join("\n\n") : T.noFindings[locale];
    return `== ${c.companyName} — ${T.score[locale]}: ${c.score}/100 ==\n${body}`;
  });
  return {
    subject: `Tesuch · ${T.digestTitle[locale]} · ${T.openFindings[locale]}: ${all.length}`,
    html: wrap(
      `<h2>${escapeHtml(T.digestTitle[locale])}</h2>${htmlBlocks.join("")}${disclaimer ? `<p><em>${escapeHtml(DISCLAIMER[locale])}</em></p>` : ""}<p><em>${escapeHtml(coverageLine(locale))}</em></p>`,
      locale,
    ),
    text: [`${T.digestTitle[locale]}`, ...textBlocks, ...(disclaimer ? [DISCLAIMER[locale]] : []), coverageLine(locale)].join("\n\n"),
  };
}
