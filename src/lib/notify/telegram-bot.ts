import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BOT_USERNAME = "Tesuch1234_bot";

const REPLIES = {
  linked: "✅ Տեսուչը միացված է։ Այստեղ կստանաք զգուշացումներ և շաբաթական ամփոփում։\n✅ Тесуч подключён. Здесь будут уведомления и еженедельная сводка.\n✅ Tesuch is connected. Alerts and the weekly digest will arrive here.",
  invalid: "⚠️ Հղումը անվավեր է կամ ժամկետանց։ Բացեք Տեսուչը և սեղմեք «Միացնել Telegram»։\n⚠️ Ссылка недействительна или устарела. Откройте Тесуч и нажмите «Подключить Telegram».\n⚠️ This link is invalid or expired. Open Tesuch and press “Connect Telegram”.",
  help: "Տեսուչ · Тесуч · Tesuch\nՄիացնելու համար բացեք հավելվածը և սեղմեք «Միացնել Telegram»։\nЧтобы подключиться, откройте приложение и нажмите «Подключить Telegram».\nTo connect, open the app and press “Connect Telegram”.",
};

interface TgUpdate {
  message?: { chat?: { id?: number; type?: string }; text?: string };
}

/** Handles one Telegram update. Returns the reply text to send (or null). Service-role client only. */
export async function handleUpdate(db: SupabaseClient, update: TgUpdate): Promise<{ chatId: number; text: string } | null> {
  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim() ?? "";
  if (!chatId || update.message?.chat?.type !== "private") return null;

  const m = /^\/start(?:\s+([A-Za-z0-9_-]{16,64}))?$/.exec(text);
  if (!m?.[1]) return { chatId, text: REPLIES.help };

  const { data: tok } = await db.from("telegram_link_tokens").select("user_id, expires_at").eq("token", m[1]).maybeSingle();
  // Single use, whatever the outcome.
  await db.from("telegram_link_tokens").delete().eq("token", m[1]);
  if (!tok || new Date(tok.expires_at) < new Date()) return { chatId, text: REPLIES.invalid };

  // A chat belongs to one user; re-linking moves it.
  await db.from("telegram_links").delete().eq("chat_id", chatId);
  const { error } = await db.from("telegram_links").upsert({ user_id: tok.user_id, chat_id: chatId, linked_at: new Date().toISOString() });
  return { chatId, text: error ? REPLIES.invalid : REPLIES.linked };
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
