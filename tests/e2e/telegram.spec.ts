// Telegram webhook end to end against the real database. No bot token in the test server, so no reply is sent;
// we assert on database effects. Needs TELEGRAM_WEBHOOK_SECRET in the environment of both runner and server.
import { expect, test } from "@playwright/test";
import { admin, createTestUser, deleteTestUsers, type TestUser } from "./helpers/supabase";

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const randomChat = () => 7_000_000_000 + Math.floor(Math.random() * 1_000_000_000);
const update = (chatId: number, text: string, type = "private") => ({
  update_id: 1,
  message: { message_id: 1, chat: { id: chatId, type }, from: { id: chatId, is_bot: false, language_code: "ru" }, text },
});

test.describe("telegram webhook", () => {
  test("rejects a missing or wrong secret", async ({ request }) => {
    expect((await request.post("/api/telegram/webhook", { data: update(1, "/stop") })).status()).toBe(401);
    const wrong = await request.post("/api/telegram/webhook", { headers: { "x-telegram-bot-api-secret-token": "x".repeat(40) }, data: update(1, "/stop") });
    expect(wrong.status()).toBe(401);
  });

  test.describe("with the secret", () => {
    test.skip(!SECRET, "TELEGRAM_WEBHOOK_SECRET not set");
    let a: TestUser;
    let b: TestUser;
    const chatA = randomChat();
    const chatB = chatA + 1;
    const post = (req: import("@playwright/test").APIRequestContext, chatId: number, text: string, type?: string) =>
      req.post("/api/telegram/webhook", { headers: { "x-telegram-bot-api-secret-token": SECRET! }, data: update(chatId, text, type) });
    const linkOf = async (userId: string) =>
      (await admin().from("telegram_links").select("chat_id").eq("user_id", userId).maybeSingle()).data?.chat_id ?? null;

    test.beforeAll(async () => {
      a = await createTestUser("tg-a");
      b = await createTestUser("tg-b");
      await admin().from("telegram_links").insert({ user_id: b.id, chat_id: chatB });
    });
    test.afterAll(async () => deleteTestUsers([a?.id, b?.id].filter(Boolean)));

    test("deep-link token links the chat once; /stop from another chat or a group cannot unlink it", async ({ request }) => {
      const token = "e2e" + Math.random().toString(36).slice(2).padEnd(29, "x");
      await admin().from("telegram_link_tokens").insert({ token, user_id: a.id });

      // A group chat is ignored even with a valid token.
      expect((await post(request, chatA, `/start ${token}`, "group")).status()).toBe(200);
      expect(await linkOf(a.id)).toBeNull();

      expect((await post(request, chatA, `/start ${token}`)).status()).toBe(200);
      expect(Number(await linkOf(a.id))).toBe(chatA);
      const { data: left } = await admin().from("telegram_link_tokens").select("token").eq("token", token);
      expect(left).toEqual([]);

      // Read-only commands do not change anything and still answer 200.
      for (const cmd of ["/status", "/issues", "/issues 1", "/help"]) expect((await post(request, chatA, cmd)).status()).toBe(200);

      // B's chat says /stop: only B is unlinked.
      await post(request, chatB, "/stop");
      expect(await linkOf(b.id)).toBeNull();
      expect(Number(await linkOf(a.id))).toBe(chatA);

      // A /stop sent from a group with A's chat id is ignored.
      await post(request, chatA, "/stop", "supergroup");
      expect(Number(await linkOf(a.id))).toBe(chatA);

      await post(request, chatA, "/stop");
      expect(await linkOf(a.id)).toBeNull();
    });

    test("malformed updates still get 200 so Telegram doesn't retry", async ({ request }) => {
      const res = await request.post("/api/telegram/webhook", {
        headers: { "x-telegram-bot-api-secret-token": SECRET!, "content-type": "application/json" },
        data: "{not json",
      });
      expect(res.status()).toBe(200);
    });
  });
});
