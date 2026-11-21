import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/a11y";
import { a11yIssues, expectNoHorizontalScroll, trackErrors } from "./helpers/page-checks";

const LOCALES = ["hy", "ru", "en"] as const;

for (const locale of LOCALES) {
  test.describe(`security page /${locale}/security`, () => {
    test("renders facts, processors, limits and the start block", async ({ page }) => {
      const errors = trackErrors(page);
      const res = await page.goto(`/${locale}/security`);
      expect(res?.status(), "HTTP status").toBeLessThan(400);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("#design li")).toHaveCount(4);
      await expect(page.locator(`#design a[href="/${locale}/check-file"]`)).toBeVisible();
      await expect(page.locator("#facts li")).toHaveCount(7);
      await expect(page.locator("#processors li")).toHaveCount(4);
      for (const name of ["Supabase", "Vercel", "Resend", "Telegram"]) {
        await expect(page.locator("#processors h3", { hasText: name })).toBeVisible();
      }
      await expect(page.locator("#facts code")).toHaveText("eu-west-1");
      await expect(page.locator("#limits li")).toHaveCount(3);
      await expect(page.locator("#start ol > li")).toHaveCount(4);
      await expect(page.locator(`#start a[href="/${locale}/terms/dpa"]`).first()).toBeVisible();
      await expect(page.locator(`#processors a[href="/${locale}/terms/dpa"]`)).toBeVisible();
      await expect(page.locator(`footer a:not([aria-current])[href="/${locale}/security"]`)).toBeVisible();
      expect(errors, "console errors").toEqual([]);
    });

    test("canonical and hreflang metadata", async ({ page }) => {
      await page.goto(`/${locale}/security`);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${locale}/security$`));
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(4);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{40,}/);
    });

    test("no horizontal scroll at 390px and touch targets are 44px", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 780 });
      await page.goto(`/${locale}/security`);
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalScroll(page);
      const small = await page.locator("main a, main button").evaluateAll((els) =>
        els
          .filter((e) => (e as HTMLElement).offsetParent !== null)
          .map((e) => ({ t: (e.textContent ?? "").trim().slice(0, 30), h: e.getBoundingClientRect().height }))
          .filter((x) => x.h < 44),
      );
      expect(small, "targets under 44px").toEqual([]);
    });

    test("passes basic and axe accessibility checks", async ({ page }, testInfo) => {
      await page.goto(`/${locale}/security`);
      await page.waitForLoadState("networkidle");
      expect(await a11yIssues(page)).toEqual([]);
      await expectNoAxeViolations(page, testInfo);
    });
  });
}

test("sitemap lists /security in every locale", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const l of LOCALES) expect(xml).toContain(`/${l}/security`);
});
