// Probe 6: Telegram webhook with the right secret but forged updates. TELEGRAM_BOT_TOKEN is NOT set locally,
// so no message is ever sent to Telegram; chat ids are fake.
import { APP, admin, cleanup, createUser, report, signIn } from "./lib.mjs";

const hook = (message) =>
  fetch(`${APP}/api/telegram/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET },
    body: JSON.stringify({ message }),
  });
const FAKE_CHAT = 990000000000 + Math.floor(Math.random() * 1e6);

try {
  const [a, b] = await Promise.all([createUser("tgA"), createUser("tgB")]);
  const A = (await signIn(a)).client;
  const { data: tok } = await A.rpc("create_telegram_link_token");
  const linked = async () => (await admin().from("telegram_links").select("user_id").eq("chat_id", FAKE_CHAT).maybeSingle()).data?.user_id;

  await hook({ chat: { id: FAKE_CHAT, type: "group" }, from: {}, text: `/start ${tok}` });
  report("group chat cannot link", !(await linked()), `linked=${await linked()}`);
  await hook({ chat: { id: FAKE_CHAT, type: "private" }, from: { is_bot: true }, text: `/start ${tok}` });
  report("bot sender cannot link", !(await linked()), `linked=${await linked()}`);
  await hook({ chat: { id: FAKE_CHAT, type: "private" }, from: {}, text: `/start ${tok}` });
  report("valid token links private chat", (await linked()) === a.id, `linked=${await linked()}`);
  await hook({ chat: { id: FAKE_CHAT + 1, type: "private" }, from: {}, text: `/start ${tok}` });
  const reused = (await admin().from("telegram_links").select("user_id").eq("chat_id", FAKE_CHAT + 1).maybeSingle()).data;
  report("link token is single use", !reused, JSON.stringify(reused));
  const r = await hook({ chat: { id: 1.5, type: "private" }, text: "/status" });
  report("malformed update -> 200, no crash", r.status === 200, `HTTP ${r.status}`);
  const big = await fetch(`${APP}/api/telegram/webhook`, { method: "POST", headers: { "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET }, body: "{" });
  report("invalid JSON -> 200, no crash", big.status === 200, `HTTP ${big.status}`);
  void b;
} finally {
  await admin().from("telegram_links").delete().in("chat_id", [FAKE_CHAT, FAKE_CHAT + 1]);
  await cleanup();
}
