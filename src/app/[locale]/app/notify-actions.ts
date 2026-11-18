"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Locale } from "@/lib/notify/i18n";
import { emailAlert, telegramAlert } from "@/lib/notify/messages";
import { sendEmailResend, sendTelegram } from "@/lib/notify/send";
import { BOT_USERNAME, ensureWebhook } from "@/lib/notify/telegram-bot";
import { supabaseForUser } from "@/lib/supabase/server";

/** Fixed origin from Vercel system env, never from the request Host header (the webhook secret goes to this URL). */
function appOrigin(): string | null {
  const host = process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL;
  return host ? `https://${host}` : null;
}

export async function connectTelegram() {
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const origin = appOrigin();
  if (token && secret && origin) await ensureWebhook(origin, token, secret);
  const { data, error } = await supabase.rpc("create_telegram_link_token");
  if (error) throw new Error(error.message);
  redirect(`https://t.me/${BOT_USERNAME}?start=${data as string}`);
}

export async function disconnectTelegram(locale: string) {
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  await supabase.from("telegram_links").delete().eq("user_id", user.id);
  revalidatePath(`/${locale}/app`);
}

/** Sends a sample alert to the signed-in user only. Returns the channels that succeeded. */
export async function sendTestAlert(locale: Locale): Promise<string[]> {
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { data: link } = await supabase.from("telegram_links").select("chat_id").eq("user_id", user.id).maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const item = {
    companyName: "Դեմո Լոգիստիկ ՍՊԸ",
    employeeName: "Demo Employee",
    finding: {
      ruleId: "probation-ending", ruleVersion: 1, article: "93", sourceUrl: "https://www.arlis.am/", ruleStatus: "needs_lawyer_review" as const,
      severity: "advisory" as const, companyId: "demo", employeeId: "demo", contractId: null, dueDate: today, overdue: false,
    },
  };

  const sent: string[] = [];
  const tg = process.env.TELEGRAM_BOT_TOKEN;
  if (tg && link?.chat_id) {
    const r = await sendTelegram(tg, Number(link.chat_id), `🧪 TEST\n${telegramAlert(item, locale)}`);
    if (r.ok) sent.push("Telegram");
  }
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;
  if (key && from && user.email) {
    const m = emailAlert(item, locale);
    const r = await sendEmailResend(key, { from, to: user.email, ...m, subject: `[TEST] ${m.subject}` });
    if (r.ok) sent.push("Email");
  }
  return sent;
}
