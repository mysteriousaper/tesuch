import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BOT_USERNAME, buildAccount, detectLocale, errorReply, helpReply, invalidReply, issuesReply, linkedReply, parseCommand,
  statusReply, unlinkedReply, UNLINKED_HELP, usageReply, type CompanyRow, type FindingRow, type OrgRow, type OrgView,
} from "./commands";
import type { Locale } from "./i18n";

export { BOT_USERNAME };

/** Upper bounds on what one chat command may read. */
const MAX_ORGS = 50;
const MAX_COMPANIES = 500;
const MAX_FINDINGS = 5000;

export interface TgUpdate {
  message?: {
    chat?: { id?: number; type?: string };
    from?: { is_bot?: boolean; language_code?: string };
    text?: string;
  };
}

export interface BotReply {
  chatId: number;
  /** Telegram HTML (parse_mode=HTML); every piece of user data is already escaped. */
  text: string;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Loads everything the user behind a linked chat may see. Scoping is by the user's own memberships: every
 * query below is filtered to those org ids, and buildAccount drops anything else again.
 */
export async function loadAccount(db: SupabaseClient, userId: string, locale: Locale, asOf = today()): Promise<OrgView[]> {
  const { data: mem, error: mErr } = await db.from("memberships").select("org_id").eq("user_id", userId).limit(MAX_ORGS);
  if (mErr) throw new Error(mErr.message);
  const orgIds = [...new Set((mem ?? []).map((m) => m.org_id as string))];
  if (!orgIds.length) return [];

  const [orgs, companies, findings] = await Promise.all([
    db.from("orgs").select("id, name, kind").in("id", orgIds),
    db.from("companies").select("id, org_id, name").in("org_id", orgIds).limit(MAX_COMPANIES),
    db
      .from("findings")
      .select("org_id, company_id, rule_id, due_date, employees(full_name)")
      .in("org_id", orgIds)
      .eq("status", "open")
      .limit(MAX_FINDINGS),
  ]);
  for (const r of [orgs, companies, findings]) if (r.error) throw new Error(r.error.message);

  const findingRows: FindingRow[] = (findings.data ?? []).map((f) => ({
    org_id: f.org_id as string,
    company_id: f.company_id as string,
    rule_id: f.rule_id as string,
    due_date: f.due_date as string,
    employee_name: (f.employees as unknown as { full_name: string } | null)?.full_name ?? null,
  }));
  const companyRows = (companies.data ?? []) as CompanyRow[];
  const staffed = await companiesWithStaff(db, orgIds, companyRows.length);
  if (staffed) for (const c of companyRows) c.staff = staffed.has(c.id) ? 1 : 0;
  const allowed = new Set(orgIds);
  const orgRows = ((orgs.data ?? []) as OrgRow[]).filter((o) => allowed.has(o.id));
  return buildAccount(orgRows, companyRows, findingRows, asOf, locale);
}

const PAGE = 1000;
const MAX_STAFF_PAGES = 50;

/**
 * Ids of companies with at least one active employee (a company with none has no score). Pages through the
 * REST row cap and stops once every company is seen; null when the scan was cut short, so nobody is wrongly
 * shown as "no data".
 */
async function companiesWithStaff(db: SupabaseClient, orgIds: string[], companyCount: number): Promise<Set<string> | null> {
  const seen = new Set<string>();
  for (let page = 0; page < MAX_STAFF_PAGES; page++) {
    const { data, error } = await db
      .from("employees")
      .select("company_id")
      .in("org_id", orgIds)
      .is("archived_at", null)
      .order("id")
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) seen.add(r.company_id as string);
    if (seen.size >= companyCount || (data ?? []).length < PAGE) return seen;
  }
  return null;
}

/** Handles one Telegram update. Returns the reply to send (or null). Service-role client only. */
export async function handleUpdate(db: SupabaseClient, update: TgUpdate): Promise<BotReply | null> {
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  // Private chats with humans only: no groups/channels, so a chat id always means one person.
  if (typeof chatId !== "number" || !Number.isSafeInteger(chatId) || msg?.chat?.type !== "private" || msg.from?.is_bot) return null;
  if (typeof msg.text !== "string") return null;
  const locale = detectLocale(msg.from?.language_code);
  const cmd = parseCommand(msg.text);
  const reply = (text: string): BotReply => ({ chatId, text });

  try {
    if (cmd.cmd === "start" && cmd.token) return reply(await link(db, chatId, cmd.token, locale));

    const { data: linkRow, error } = await db.from("telegram_links").select("user_id").eq("chat_id", chatId).maybeSingle();
    if (error) return reply(errorReply(locale));
    const userId = (linkRow?.user_id as string | undefined) ?? null;
    if (!userId) return reply(UNLINKED_HELP);

    switch (cmd.cmd) {
      case "stop": {
        const { error: dErr } = await db.from("telegram_links").delete().eq("chat_id", chatId);
        return reply(dErr ? errorReply(locale) : unlinkedReply(locale));
      }
      case "status":
        return reply(statusReply(await loadAccount(db, userId, locale), locale));
      case "issues":
        if (cmd.badArg) return reply(usageReply(locale));
        return reply(issuesReply(await loadAccount(db, userId, locale), cmd.companyNo, locale));
      default:
        return reply(helpReply(locale));
    }
  } catch {
    return reply(errorReply(locale));
  }
}

async function link(db: SupabaseClient, chatId: number, token: string, locale: Locale): Promise<string> {
  const { data: tok } = await db.from("telegram_link_tokens").select("user_id, expires_at").eq("token", token).maybeSingle();
  // Single use, whatever the outcome.
  await db.from("telegram_link_tokens").delete().eq("token", token);
  if (!tok || new Date(tok.expires_at) < new Date()) return invalidReply(locale);

  // A chat belongs to one user; re-linking moves it.
  await db.from("telegram_links").delete().eq("chat_id", chatId);
  const { error } = await db.from("telegram_links").upsert({ user_id: tok.user_id, chat_id: chatId, linked_at: new Date().toISOString() });
  return error ? invalidReply(locale) : linkedReply(locale);
}

/** Points the bot's webhook at this deployment. Idempotent; skips the call if already set. */
export async function ensureWebhook(origin: string, token: string, secret: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const url = `${origin}/api/telegram/webhook${bypass ? `?x-vercel-protection-bypass=${encodeURIComponent(bypass)}` : ""}`;
  const info = await fetchImpl(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json()).catch(() => null);
  if (info?.result?.url === url) return;
  await fetchImpl(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true }),
  });
}
