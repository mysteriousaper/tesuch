import { expect, test } from "@playwright/test";
import { a11yIssues, expectNoHorizontalScroll } from "./helpers/page-checks";

const NOT_FOUND = {
  hy: { meta: "Էջը չի գտնվել", title: "Այս էջը գոյություն չունի", home: "Գլխավոր էջ", app: "Բացել վահանակը" },
  ru: { meta: "Страница не найдена", title: "Такой страницы нет", home: "На главную", app: "Открыть панель" },
  en: { meta: "Page not found", title: "This page doesn't exist", home: "Home page", app: "Open dashboard" },
} as const;

test.describe("Platform: 404, error boundary, health", () => {
  for (const [locale, text] of Object.entries(NOT_FOUND)) {
    test(`unknown path shows the localized 404 (${locale})`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const res = await page.goto(`/${locale}/definitely/not/a/page`);
      expect(res?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(text.title);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("main").getByRole("link", { name: text.home })).toHaveAttribute("href", `/${locale}`);
      await expect(page.getByRole("main").getByRole("link", { name: text.app })).toHaveAttribute("href", `/${locale}/app`);
      await expect(page).toHaveTitle(new RegExp(`^${text.meta} · `));
      await expectNoHorizontalScroll(page);
      expect(await a11yIssues(page)).toEqual([]);
    });
  }

  test("unknown path inside /app is a 404 too", async ({ request }) => {
    const res = await request.get("/ru/app/no-such-section", { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  });

  test("health endpoint: shape, no caching, no secrets", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["db", "ok", "time", "version"]);
    expect(body.ok).toBe(true);
    expect(typeof body.version).toBe("string");
    expect(body.version.length).toBeGreaterThan(0);
    expect(Math.abs(Date.parse(body.time) - Date.now())).toBeLessThan(5 * 60_000);
    expect(Object.keys(body.db).sort()).toEqual(["latencyMs", "ok"]);
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      expect(body.db.ok).toBe(true);
      expect(body.db.latencyMs).toBeLessThan(2500);
    }
    const raw = await res.text();
    for (const secret of [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
      if (secret) expect(raw).not.toContain(secret);
    }
    expect(raw).not.toMatch(/supabase\.co/);
  });

  test("error boundary is localized, offers retry and leaks nothing", async ({ page }) => {
    const res = await page.goto("/hy/platform-error-probe");
    expect(res?.status()).toBe(500);
    const alert = page.getByRole("alert", { name: "Ինչ-որ բան այնպես չգնաց" });
    await expect(alert.getByRole("heading", { level: 1 })).toHaveText("Ինչ-որ բան այնպես չգնաց");
    await expect(alert.getByRole("button", { name: "Նորից փորձել" })).toBeVisible();
    await expect(alert).toContainText(/Սխալի կոդը՝ \d+/);

    const html = await page.content();
    expect(html).not.toContain("SECRET_PROBE");
    expect(html).not.toContain("error-probe:");
    expect(html).not.toMatch(/\.next\/server|at [A-Za-z_$][\w$]* \(/);

    // Retry re-requests the page; the probe throws again, so the boundary stays and still shows no internals.
    await alert.getByRole("button", { name: "Նորից փորձել" }).click();
    await expect(alert.getByRole("heading", { level: 1 })).toHaveText("Ինչ-որ բան այնպես չգնաց");
    expect(await page.content()).not.toContain("SECRET_PROBE");
  });
});
