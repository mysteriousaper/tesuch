import { expect, test } from "@playwright/test";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { pdfUrls, seedDocsFixture, type DocsFixture } from "./helpers/lane-c";
import { createTestUser, deleteTestUsers, type TestUser } from "./helpers/supabase";

/** PDF routes read through the user's RLS client: another firm's rows must look like they don't exist. */
test.describe("PDF routes: tenancy and error pages", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");
  test.describe.configure({ mode: "serial" });

  let a: TestUser, b: TestUser;
  let fxA: DocsFixture;

  test.beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser("pdf-a"), createTestUser("pdf-b")]);
    [fxA] = await Promise.all([seedDocsFixture(a, "PDF A"), seedDocsFixture(b, "PDF B")]);
  });
  test.afterAll(async () => deleteTestUsers([a?.id, b?.id].filter(Boolean)));

  test("owner A can render every document for A's data", async ({ page }) => {
    await signInViaUi(page, a, "en");
    for (const [name, url] of Object.entries(pdfUrls(fxA))) {
      const r = await page.request.get(url);
      expect(r.status(), name).toBe(200);
      expect(r.headers()["content-type"], name).toBe("application/pdf");
      expect((await r.body()).subarray(0, 4).toString(), name).toBe("%PDF");
    }
  });

  test("user B gets 404 for every /api/pdf/* URL of A's company and contracts", async ({ page }) => {
    await signInViaUi(page, b, "en");
    for (const [name, url] of Object.entries(pdfUrls(fxA))) {
      const r = await page.request.get(url, { headers: { accept: "application/json" } });
      expect(r.status(), name).toBe(404);
      expect(await r.json(), name).toEqual({ error: "not found" });
    }
  });

  test("browser navigation to a failing PDF shows a localized HTML page, not raw JSON", async ({ page }) => {
    await signInViaUi(page, b, "ru");
    await page.goto("/ru/app/documents");
    // Navigating from a /ru page: Russian message, link back to documents, real 404 status.
    const res = await page.goto(pdfUrls(fxA).probation, { referer: page.url() });
    expect(res?.status()).toBe(404);
    expect(res?.headers()["content-type"]).toContain("text/html");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Не удалось создать документ");
    await expect(page.getByText("Документ не найден")).toBeVisible();
    await expect(page.getByRole("link", { name: /Вернуться к документам/ })).toHaveAttribute("href", "/ru/app/documents");

    const bad = await page.goto("/api/pdf/fixed-term-end?contract=not-a-uuid&locale=hy");
    expect(bad?.status()).toBe(400);
    await expect(page.locator("html")).toHaveAttribute("lang", "hy");
  });

  test("signed out: 401 (JSON for API callers, sign-in link for browsers)", async ({ browser }) => {
    const ctx = await browser.newContext();
    const api = await ctx.request.get(pdfUrls(fxA).checklist, { headers: { accept: "application/json" } });
    expect(api.status()).toBe(401);
    expect(await api.json()).toEqual({ error: "unauthorized" });

    const page = await ctx.newPage();
    const res = await page.goto(`${pdfUrls(fxA).checklist.replace("locale=hy", "locale=en")}`);
    expect(res?.status()).toBe(401);
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/en/login");
    await ctx.close();
  });
});
