// Telegram bot commands: parsing, locale detection and reply formatting. Pure: no network, no clock, no DB.
// I/O (which rows to load, and for whom) lives in telegram-bot.ts.
import { effectiveSeverity } from "../rules/engine";
import { firmScore, inspectionReadyScore } from "../rules/score";
import type { EffectiveSeverity, IsoDate } from "../rules/types";
import { DISCLAIMER, escapeHtml, formatDate, ruleById, SEVERITY_LABEL, T, type Locale } from "./i18n";
import { TELEGRAM_MAX } from "./messages";

export const BOT_USERNAME = "Tesuch1234_bot";
/** /issues shows at most this many findings. */
export const ISSUES_LIMIT = 5;
/** Ignore absurdly long inputs instead of regex-scanning them. */
const MAX_INPUT = 512;

// ---------- Locale ----------

/** Telegram `language_code` (IETF tag, e.g. "ru", "hy-AM", "en-US") → bot locale. Anything else → en. */
export function detectLocale(languageCode: string | null | undefined): Locale {
  const base = (languageCode ?? "").toLowerCase().split(/[-_]/)[0];
  return base === "hy" || base === "ru" ? base : "en";
}

// ---------- Parsing ----------

export type Command =
  | { cmd: "start"; token: string | null }
  | { cmd: "status" }
  | { cmd: "issues"; companyNo: number | null; badArg: boolean }
  | { cmd: "help" }
  | { cmd: "stop" }
  | { cmd: "unknown" }
  | { cmd: "text" };

/** Parses one message text. Accepts "/cmd@Tesuch1234_bot args"; commands addressed to another bot are "unknown". */
export function parseCommand(raw: string | null | undefined): Command {
  const text = (raw ?? "").trim();
  if (!text.startsWith("/")) return { cmd: "text" };
  if (text.length > MAX_INPUT) return { cmd: "unknown" };
  const m = /^\/([A-Za-z_]{1,32})(?:@([A-Za-z0-9_]{1,64}))?(?:\s+([\s\S]*))?$/.exec(text);
  if (!m) return { cmd: "unknown" };
  if (m[2] && m[2].toLowerCase() !== BOT_USERNAME.toLowerCase()) return { cmd: "unknown" };
  const name = m[1].toLowerCase();
  const arg = (m[3] ?? "").trim();
  switch (name) {
    case "start":
      return { cmd: "start", token: /^[A-Za-z0-9_-]{16,64}$/.test(arg) ? arg : null };
    case "status":
      return { cmd: "status" };
    case "issues": {
      if (!arg) return { cmd: "issues", companyNo: null, badArg: false };
      const n = /^[#№]?\s*(\d{1,4})$/.exec(arg);
      const no = n ? Number(n[1]) : 0;
      return no >= 1 ? { cmd: "issues", companyNo: no, badArg: false } : { cmd: "issues", companyNo: null, badArg: true };
    }
    case "help":
      return { cmd: "help" };
    case "stop":
      return { cmd: "stop" };
    default:
      return { cmd: "unknown" };
  }
}

// ---------- Strings ----------

const S = {
  linked: {
    hy: "✅ Տեսուչը միացված է։ Այստեղ կստանաք զգուշացումներ և շաբաթական ամփոփում։",
    ru: "✅ Тесуч подключён. Здесь будут уведомления и еженедельная сводка.",
    en: "✅ Tesuch is connected. Alerts and the weekly digest will arrive here.",
  },
  invalid: {
    hy: "⚠️ Հղումը անվավեր է կամ ժամկետանց։ Բացեք Տեսուչը և սեղմեք «Միացնել Telegram»։",
    ru: "⚠️ Ссылка недействительна или устарела. Откройте Тесуч и нажмите «Подключить Telegram».",
    en: "⚠️ This link is invalid or expired. Open Tesuch and press “Connect Telegram”.",
  },
  helpTitle: { hy: "Տեսուչ բոտի հրամաններ", ru: "Команды бота Тесуч", en: "Tesuch bot commands" },
  helpStatus: {
    hy: "ընկերությունները, պատրաստվածության միավորը և բաց հարցերը",
    ru: "компании, балл готовности и открытые замечания",
    en: "your companies, Inspection-Ready Score and open findings",
  },
  helpIssues: { hy: "5 առաջնային բաց հարցերը", ru: "топ-5 открытых замечаний", en: "top 5 open findings" },
  helpStop: { hy: "անջատել Telegram-ը", ru: "отключить Telegram", en: "disconnect Telegram" },
  helpHelp: { hy: "այս օգնությունը", ru: "эта справка", en: "this help" },
  numberArg: { hy: "համար", ru: "номер", en: "number" },
  unlinked: {
    hy: "🔕 Telegram-ը անջատված է։ Այլևս ծանուցումներ չեք ստանա։ Կրկին միացնելու համար հավելվածում սեղմեք «Միացնել Telegram»։",
    ru: "🔕 Telegram отключён. Уведомления больше не будут приходить. Чтобы подключить снова, нажмите «Подключить Telegram» в приложении.",
    en: "🔕 Telegram is disconnected. You will no longer receive alerts here. To reconnect, press “Connect Telegram” in the app.",
  },
  noOrgs: {
    hy: "Դուք դեռ որևէ կազմակերպության անդամ չեք։",
    ru: "Вы пока не состоите ни в одной организации.",
    en: "You are not a member of any organisation yet.",
  },
  noCompanies: { hy: "Ընկերություններ դեռ չկան։", ru: "Компаний пока нет.", en: "No companies yet." },
  accounting_firm: { hy: "Հաշվապահական ընկերություն", ru: "Бухгалтерская фирма", en: "Accounting firm" },
  companyKind: { hy: "Ընկերություն", ru: "Компания", en: "Company" },
  average: { hy: "Միջին միավոր", ru: "Средний балл", en: "Average score" },
  issuesHint: { hy: "Մանրամասներ՝ /issues <համար>", ru: "Подробнее: /issues <номер>", en: "Details: /issues <number>" },
  badCompany: {
    hy: (n: number) => `Ընկերություն №${n} չի գտնվել։ Ուղարկեք /status՝ համարները տեսնելու համար։`,
    ru: (n: number) => `Компания №${n} не найдена. Отправьте /status, чтобы увидеть номера.`,
    en: (n: number) => `Company #${n} not found. Send /status to see the numbers.`,
  },
  usage: {
    hy: "Օգտագործում՝ /issues կամ /issues <համար> (համարը՝ /status-ից)։",
    ru: "Использование: /issues или /issues <номер> (номер из /status).",
    en: "Usage: /issues or /issues <number> (number from /status).",
  },
  error: {
    hy: "⚠️ Չհաջողվեց բեռնել տվյալները։ Փորձեք ավելի ուշ։",
    ru: "⚠️ Не удалось загрузить данные. Попробуйте позже.",
    en: "⚠️ Couldn't load your data. Please try again later.",
  },
} as const;

/** Shown to chats that are not linked to any account. Trilingual: we cannot be sure of the reader yet. */
export const UNLINKED_HELP =
  "Տեսուչ · Тесуч · Tesuch\nՄիացնելու համար բացեք հավելվածը և սեղմեք «Միացնել Telegram»։\nЧтобы подключиться, откройте приложение и нажмите «Подключить Telegram».\nTo connect, open the app and press “Connect Telegram”.";

const e = escapeHtml;

export function linkedReply(locale: Locale): string {
  return `${e(S.linked[locale])}\n\n${helpReply(locale)}`;
}
export const invalidReply = (locale: Locale) => e(S.invalid[locale]);
export const unlinkedReply = (locale: Locale) => e(S.unlinked[locale]);
export const errorReply = (locale: Locale) => e(S.error[locale]);
export const usageReply = (locale: Locale) => e(S.usage[locale]);

export function helpReply(locale: Locale): string {
  return [
    `<b>${e(S.helpTitle[locale])}</b>`,
    `/status — ${e(S.helpStatus[locale])}`,
    `/issues [${e(S.numberArg[locale])}] — ${e(S.helpIssues[locale])}`,
    `/stop — ${e(S.helpStop[locale])}`,
    `/help — ${e(S.helpHelp[locale])}`,
  ].join("\n");
}

// ---------- Account model ----------

export interface OrgRow {
  id: string;
  name: string;
  kind: "accounting_firm" | "company";
}
export interface CompanyRow {
  id: string;
  org_id: string;
  name: string;
  /** Active head count; when absent the count is unknown and the score is computed as usual. */
  staff?: number;
}
export interface FindingRow {
  org_id: string;
  company_id: string;
  rule_id: string;
  due_date: IsoDate;
  employee_name: string | null;
}

export interface Issue {
  title: string;
  severity: EffectiveSeverity;
  dueDate: IsoDate;
  overdue: boolean;
  employeeName: string;
  companyName: string;
}
export interface CompanyView {
  /** 1-based, stable across /status and /issues. */
  no: number;
  name: string;
  /** null = no staff yet (nothing to score). */
  score: number | null;
  open: number;
  overdue: number;
  issues: Issue[];
}
export interface OrgView {
  name: string;
  kind: OrgRow["kind"];
  /** Mean company score; null when the org has no companies. */
  score: number | null;
  companies: CompanyView[];
}

const SEVERITY_ORDER: Record<EffectiveSeverity, number> = { red: 0, amber: 1, advisory: 2, info: 3 };
const byName = <X extends { name: string; id: string }>(a: X, b: X) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.dueDate.localeCompare(b.dueDate) ||
      a.title.localeCompare(b.title),
  );
}

/**
 * Builds the view of everything the linked user may see. `orgs` must already be limited to orgs the user is a
 * member of; companies and findings of any other org are dropped here as a second line of defence.
 */
export function buildAccount(orgs: OrgRow[], companies: CompanyRow[], findings: FindingRow[], asOf: IsoDate, locale: Locale): OrgView[] {
  const orgIds = new Set(orgs.map((o) => o.id));
  const companyOrg = new Map<string, string>();
  for (const c of companies) if (orgIds.has(c.org_id)) companyOrg.set(c.id, c.org_id);

  const issuesBy = new Map<string, Issue[]>();
  for (const f of findings) {
    if (!orgIds.has(f.org_id) || companyOrg.get(f.company_id) !== f.org_id) continue;
    let rule;
    try {
      rule = ruleById(f.rule_id);
    } catch {
      continue; // rule removed from the catalog
    }
    const list = issuesBy.get(f.company_id) ?? [];
    list.push({
      title: rule.title[locale],
      // Recompute from the current rule status so a stale "red" never shows for an unverified rule.
      severity: effectiveSeverity(rule),
      dueDate: f.due_date,
      overdue: f.due_date < asOf,
      employeeName: f.employee_name ?? "",
      companyName: "",
    });
    issuesBy.set(f.company_id, list);
  }

  let no = 0;
  return [...orgs].sort(byName).map((o) => {
    const views = companies
      .filter((c) => c.org_id === o.id && companyOrg.get(c.id) === o.id)
      .sort(byName)
      .map((c): CompanyView => {
        const issues = sortIssues((issuesBy.get(c.id) ?? []).map((i) => ({ ...i, companyName: c.name })));
        return {
          no: ++no,
          name: c.name,
          score: c.staff === 0 ? null : inspectionReadyScore(issues),
          open: issues.length,
          overdue: issues.filter((i) => i.overdue).length,
          issues,
        };
      });
    return { name: o.name, kind: o.kind, score: firmScore(views.map((v) => v.score)), companies: views };
  });
}

// ---------- Formatting ----------

interface Entry {
  text: string;
  /** Counted in the "… and N more" line when dropped. */
  countable: boolean;
}

/** Joins entries under `header`, dropping trailing ones (never cutting mid-tag) to stay under Telegram's limit. */
export function fit(header: string, entries: Entry[], footer: string, locale: Locale, max = TELEGRAM_MAX): string {
  const reserve = 64; // room for the "… and N more" line
  let body = "";
  let i = 0;
  for (; i < entries.length; i++) {
    const candidate = body + entries[i].text;
    if ((header + candidate + footer).length + reserve > max) break;
    body = candidate;
  }
  const omitted = entries.slice(i).filter((x) => x.countable).length;
  const more = omitted > 0 ? `\n… ${e(T.andMore[locale](omitted))}` : "";
  return header + body + more + footer;
}

const scoreIcon = (s: number | null) => (s === null ? "⚪" : s >= 80 ? "🟢" : s >= 50 ? "🟠" : "🔴");
const scoreText = (s: number | null, locale: Locale) => (s === null ? `<b>${e(T.noScore[locale])}</b>` : `<b>${s}</b>/100`);
const ICON: Record<EffectiveSeverity, string> = { red: "🔴", amber: "🟠", advisory: "🟡", info: "🔵" };

export function statusReply(orgs: OrgView[], locale: Locale): string {
  if (!orgs.length) return e(S.noOrgs[locale]);
  const header = `📊 <b>Tesuch · ${e(T.score[locale])}</b>`;
  const entries: Entry[] = [];
  for (const o of orgs) {
    const kind = o.kind === "accounting_firm" ? S.accounting_firm[locale] : S.companyKind[locale];
    const avg = o.kind === "accounting_firm" && o.score !== null ? ` — ${e(S.average[locale])}: <b>${o.score}</b>/100` : "";
    entries.push({ text: `\n\n🏢 <b>${e(o.name)}</b> · ${e(kind)}${avg}`, countable: false });
    if (!o.companies.length) entries.push({ text: `\n${e(S.noCompanies[locale])}`, countable: false });
    for (const c of o.companies) {
      const overdue = c.overdue ? ` (⏰ ${c.overdue} ${e(T.overdue[locale])})` : "";
      entries.push({
        text: `\n${c.no}. ${scoreIcon(c.score)} ${e(c.name)} — ${scoreText(c.score, locale)} · ${e(T.openFindings[locale])}: ${c.open}${overdue}`,
        countable: true,
      });
    }
  }
  const any = orgs.some((o) => o.companies.length > 0);
  const footer = any ? `\n\n<i>${e(S.issuesHint[locale])}</i>` : "";
  return fit(header, entries, footer, locale);
}

function issueText(i: Issue, locale: Locale, withCompany: boolean): string {
  const who = [withCompany ? i.companyName : "", i.employeeName].filter(Boolean).join(" · ");
  const due = `${T.due[locale]}: ${formatDate(i.dueDate)}${i.overdue ? ` · ⏰ ${T.overdue[locale]}` : ""}`;
  return [`${ICON[i.severity]} ${e(SEVERITY_LABEL[locale][i.severity])}: <b>${e(i.title)}</b>`, ...(who ? [e(who)] : []), e(due)].join("\n");
}

/** Top open findings: of company `companyNo` (from /status), or across all companies when null. */
export function issuesReply(orgs: OrgView[], companyNo: number | null, locale: Locale): string {
  if (!orgs.length) return e(S.noOrgs[locale]);
  const all = orgs.flatMap((o) => o.companies);
  let title: string;
  let issues: Issue[];
  if (companyNo !== null) {
    const c = all.find((x) => x.no === companyNo);
    if (!c) return e(S.badCompany[locale](companyNo));
    title = `${e(T.openFindings[locale])} · ${e(c.name)} — ${scoreText(c.score, locale)}`;
    issues = c.issues;
  } else {
    if (!all.length) return e(S.noCompanies[locale]);
    title = e(T.openFindings[locale]);
    issues = sortIssues(all.flatMap((c) => c.issues));
  }
  const header = `📌 <b>${title}</b>`;
  if (!issues.length) return `${header}\n\n✅ ${e(T.noFindings[locale])}`;
  const shown = issues.slice(0, ISSUES_LIMIT);
  const entries: Entry[] = shown.map((i) => ({ text: `\n\n${issueText(i, locale, companyNo === null)}`, countable: true }));
  const rest = issues.length - shown.length;
  const restLine = rest > 0 ? `\n\n… ${e(T.andMore[locale](rest))}` : "";
  const footer = `${restLine}\n\n<i>${e(DISCLAIMER[locale])}</i>`;
  return fit(header, entries, footer, locale);
}
