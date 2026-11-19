import { NextResponse } from "next/server";
import { sendTelegram, verifyTelegramSecret } from "@/lib/notify/send";
import { handleUpdate } from "@/lib/notify/telegram-bot";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!verifyTelegramSecret(req.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  try {
    const reply = await handleUpdate(supabaseService(), await req.json());
    // Replies are Telegram HTML built by commands.ts, which escapes every piece of user data.
    if (reply && token) await sendTelegram(token, reply.chatId, reply.text);
  } catch {
    // Always 200 so Telegram doesn't retry a malformed update forever.
  }
  return NextResponse.json({ ok: true });
}
