// Thin senders. Fetch is injectable so tests never hit the network. Errors never include secrets.
import { timingSafeEqual } from "node:crypto";

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface SendResult {
  ok: boolean;
  error?: string;
}

async function post(fetchImpl: FetchLike, url: string, headers: Record<string, string>, body: unknown): Promise<SendResult> {
  try {
    const res = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    if (res.ok) return { ok: true };
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    return { ok: false, error: `HTTP ${res.status}${detail ? `: ${detail}` : ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

export function sendTelegram(token: string, chatId: string | number, html: string, fetchImpl: FetchLike = fetch): Promise<SendResult> {
  return post(fetchImpl, `https://api.telegram.org/bot${token}/sendMessage`, {}, {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

export interface EmailPayload {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export function sendEmailResend(apiKey: string, payload: EmailPayload, fetchImpl: FetchLike = fetch): Promise<SendResult> {
  return post(fetchImpl, "https://api.resend.com/emails", { authorization: `Bearer ${apiKey}` }, payload);
}

/** Checks Telegram's X-Telegram-Bot-Api-Secret-Token header in constant time. */
export function verifyTelegramSecret(header: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
