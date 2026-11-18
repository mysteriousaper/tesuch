import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "./i18n";
import { emailAlert, emailDigest, telegramAlert, telegramDigest, type AlertItem, type DigestCompany } from "./messages";
import { sendEmailResend, sendTelegram, type SendResult } from "./send";

/** Per org per night: send at most this many individual alerts; the rest go into the weekly digest. */
export const MAX_ALERTS_PER_RUN = 5;

export interface Channels {
  telegramToken?: string;
  resendKey?: string;
  from?: string;
}

export function channelsFromEnv(): Channels {
  return { telegramToken: process.env.TELEGRAM_BOT_TOKEN, resendKey: process.env.RESEND_API_KEY, from: process.env.ALERT_FROM_EMAIL };
}

export interface Recipient {
  userId: string;
  email: string | null;
  chatId: number | null;
}

/** Owners and accountants of the org, with their email and linked Telegram chat. Service-role client only. */
export async function recipientsForOrg(db: SupabaseClient, orgId: string): Promise<Recipient[]> {
  const { data: members, error } = await db.from("memberships").select("user_id").eq("org_id", orgId).in("role", ["owner", "accountant"]);
  if (error) throw new Error(error.message);
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (!ids.length) return [];
  const { data: links } = await db.from("telegram_links").select("user_id, chat_id").in("user_id", ids);
  const chat = new Map((links ?? []).map((l) => [l.user_id as string, Number(l.chat_id)]));
  const out: Recipient[] = [];
  for (const id of ids) {
    const { data } = await db.auth.admin.getUserById(id);
    out.push({ userId: id, email: data.user?.email ?? null, chatId: chat.get(id) ?? null });
  }
  return out;
}

type Log = { org_id: string; finding_id: string | null; channel: "telegram" | "email"; kind: "alert" | "weekly_digest"; ok: boolean; error: string | null };

async function logAll(db: SupabaseClient, rows: Log[]) {
  if (rows.length) await db.from("alerts_log").insert(rows);
}

const toLog = (orgId: string, findingId: string | null, channel: Log["channel"], kind: Log["kind"], r: SendResult): Log => ({
  org_id: orgId, finding_id: findingId, channel, kind, ok: r.ok, error: r.error ?? null,
});

/** New findings → one message per finding, per recipient, per linked channel. Never throws on a send failure. */
export async function deliverAlerts(
  db: SupabaseClient, orgId: string, locale: Locale, items: (AlertItem & { findingId: string })[], ch: Channels = channelsFromEnv(),
): Promise<number> {
  if (!items.length) return 0;
  const recipients = await recipientsForOrg(db, orgId);
  const logs: Log[] = [];
  for (const item of items.slice(0, MAX_ALERTS_PER_RUN)) {
    for (const r of recipients) {
      if (ch.telegramToken && r.chatId) logs.push(toLog(orgId, item.findingId, "telegram", "alert", await sendTelegram(ch.telegramToken, r.chatId, telegramAlert(item, locale))));
      if (ch.resendKey && ch.from && r.email) {
        const m = emailAlert(item, locale);
        logs.push(toLog(orgId, item.findingId, "email", "alert", await sendEmailResend(ch.resendKey, { from: ch.from, to: r.email, ...m })));
      }
    }
  }
  await logAll(db, logs);
  return logs.filter((l) => l.ok).length;
}

export async function deliverDigest(
  db: SupabaseClient, orgId: string, locale: Locale, companies: DigestCompany[], ch: Channels = channelsFromEnv(),
): Promise<number> {
  const recipients = await recipientsForOrg(db, orgId);
  const logs: Log[] = [];
  for (const r of recipients) {
    if (ch.telegramToken && r.chatId) logs.push(toLog(orgId, null, "telegram", "weekly_digest", await sendTelegram(ch.telegramToken, r.chatId, telegramDigest(companies, locale))));
    if (ch.resendKey && ch.from && r.email) {
      const m = emailDigest(companies, locale);
      logs.push(toLog(orgId, null, "email", "weekly_digest", await sendEmailResend(ch.resendKey, { from: ch.from, to: r.email, ...m })));
    }
  }
  await logAll(db, logs);
  return logs.filter((l) => l.ok).length;
}
