import { expect, test } from "@playwright/test";

test.describe("API hardening", () => {
  test("nightly job rejects a missing bearer token", async ({ request }) => {
    const res = await request.get("/api/jobs/nightly");
    expect(res.status()).toBe(401);
  });

  test("nightly job rejects a wrong bearer token", async ({ request }) => {
    const res = await request.get("/api/jobs/nightly", { headers: { authorization: `Bearer ${"x".repeat(64)}` } });
    expect(res.status()).toBe(401);
  });

  test("telegram webhook rejects requests without the secret header", async ({ request }) => {
    const res = await request.post("/api/telegram/webhook", { data: { message: { chat: { id: 1, type: "private" }, text: "/start x" } } });
    expect(res.status()).toBe(401);
  });

  test("telegram webhook rejects a wrong secret", async ({ request }) => {
    const res = await request.post("/api/telegram/webhook", {
      headers: { "x-telegram-bot-api-secret-token": "wrong-secret" },
      data: { message: { chat: { id: 1, type: "private" }, text: "/start x" } },
    });
    expect(res.status()).toBe(401);
  });

  for (const next of ["//evil.example.com", "https://evil.example.com", "/\\evil.example.com", "/hy/../../evil"]) {
    test(`auth callback never redirects off-site (next=${next})`, async ({ request, baseURL }) => {
      const res = await request.get(`/api/auth/callback?code=bogus&next=${encodeURIComponent(next)}`, { maxRedirects: 0 });
      expect(res.status()).toBeGreaterThanOrEqual(300);
      expect(res.status()).toBeLessThan(400);
      const location = new URL(res.headers()["location"], baseURL);
      expect(location.origin).toBe(new URL(baseURL!).origin);
    });
  }

  test("auth callback with a bogus code lands on login with an error", async ({ request }) => {
    const res = await request.get("/api/auth/callback?code=bogus&next=/ru/app", { maxRedirects: 0 });
    expect(res.headers()["location"]).toMatch(/\/ru\/login\?error=1$/);
  });
});
