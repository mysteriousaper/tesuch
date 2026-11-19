import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/a11y";
import { a11yIssues, expectNoHorizontalScroll, trackErrors } from "./helpers/page-checks";

const PAGES: { path: string; lang: string }[] = [
  { path: "/hy", lang: "hy" },
  { path: "/ru", lang: "ru" },
  { path: "/en", lang: "en" },
  { path: "/hy/themes", lang: "hy" },
  { path: "/ru/themes", lang: "ru" },
  { path: "/hy/login", lang: "hy" },
  { path: "/ru/login", lang: "ru" },
  { path: "/en/login", lang: "en" },
  { path: "/hy/check", lang: "hy" },
  { path: "/ru/check", lang: "ru" },
  { path: "/en/check", lang: "en" },
];

test.describe("public pages", () => {
  // Browser-language detection is off (QA D-3): everyone lands on Armenian and switches explicitly.
  for (const [locale, expected] of [["hy-AM", "hy"], ["de-DE", "hy"], ["ru-RU", "hy"], ["en-US", "hy"]] as const) {
    test(`root always redirects to Armenian (${locale} → ${expected})`, async ({ browser }) => {
      const ctx = await browser.newContext({ locale });
      const page = await ctx.newPage();
      await page.goto("/");
      await expect(page).toHaveURL(new RegExp(`/${expected}/?$`));
      await expect(page.locator("html")).toHaveAttribute("lang", expected);
      await ctx.close();
    });
  }

  for (const { path, lang } of PAGES) {
    test(`${path} renders cleanly`, async ({ page }) => {
      const errors = trackErrors(page);
      const res = await page.goto(path);
      expect(res?.status(), "HTTP status").toBeLessThan(400);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("h1")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalScroll(page);
      expect(errors, "console errors").toEqual([]);
    });

    test(`${path} passes basic accessibility checks`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await a11yIssues(page)).toEqual([]);
    });

    test(`${path} has no axe WCAG A/AA violations`, async ({ page }, testInfo) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoAxeViolations(page, testInfo);
    });
  }

  test("locale switcher keeps the current page", async ({ page }) => {
    await page.goto("/hy/themes");
    await page.getByRole("navigation", { name: "Language" }).getByRole("link", { name: "Рус" }).click();
    await expect(page).toHaveURL(/\/ru\/themes$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/hy");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });
});
