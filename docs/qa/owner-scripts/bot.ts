import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { handleUpdate } from "../../../src/lib/notify/telegram-bot";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) process.env[m[1]] = m[2]; }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const u = JSON.parse(readFileSync("/tmp/claude-0/s/user.json", "utf8"));
const CHAT = 987654321;
const send = async (text: string, lang = "hy") => {
  const r = await handleUpdate(db, { message: { chat: { id: CHAT, type: "private" }, from: { language_code: lang }, text } });
  console.log(`\n>>> [${lang}] ${text}\n${r?.text ?? "(null)"}`);
};
(async () => {
  await send("/status");
  await send("Բարև");
  await send("/start");
  await send("/start BADTOKENBADTOKENBADTOKEN123");
  const token = "qaownertoken" + Math.random().toString(36).slice(2, 12) + "abcd";
  await db.from("telegram_link_tokens").insert({ user_id: u.id, token, expires_at: new Date(Date.now() + 600000).toISOString() });
  await send("/start " + token);
  await send("/start " + token); // reuse
  await send("/status"); await send("/issues"); await send("/issues 1"); await send("/issues 9"); await send("/issues abc");
  await send("/status", "ru"); await send("/issues", "ru"); await send("/help", "en"); await send("/foo");
  await send("/help"); await send("hello");
  await send("/stop"); await send("/status");
  await db.from("telegram_links").delete().eq("chat_id", CHAT);
})();
