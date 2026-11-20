import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/a11y";
import { a11yIssues, expectNoHorizontalScroll, trackErrors } from "./helpers/page-checks";

const LOCALES = ["hy", "ru", "en"] as const;

for (const locale of LOCALES) {
  test.describe(`client guide /${locale}/guide`, () => {
    test("renders with ten steps, loaded screenshots and no console errors", async ({ page }) => {
      const errors = trackErrors(page);
      const res = await page.goto(`/${locale}/guide`);
      expect(res?.status(), "HTTP status").toBeLessThan(400);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page).toHaveTitle(/\S/);
      await expect(page.locator("#how ol > li")).toHaveCount(10);

      // Lazy images: scroll through the page so every screenshot loads, then check each decoded.
      const imgs = page.locator("#how img");
      const total = await imgs.count();
      expect(total).toBeGreaterThanOrEqual(10);
      expect(total).toBeLessThanOrEqual(12);
      for (let i = 0; i < total; i++) {
        await imgs.nth(i).scrollIntoViewIfNeeded();
        await expect.poll(() => imgs.nth(i).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
        expect((await imgs.nth(i).getAttribute("alt"))?.trim().length ?? 0).toBeGreaterThan(10);
      }

      // Calls to action and bot commands.
      await expect(page.locator(`main a[href="/${locale}/check"]`).first()).toBeVisible();
      await expect(page.locator(`main a[href="/${locale}/login"]`).first()).toBeVisible();
      await expect(page.locator("#how code")).toHaveText(["/status", "/issues", "/issues 2", "/help", "/stop"]);
      await expect(page.locator("#faq dt")).toHaveCount(5);
      expect(errors, "console errors").toEqual([]);
    });

    test("done-for-you section links to the security page", async ({ page }) => {
      await page.goto(`/${locale}/guide`);
      await expect(page.locator("#done li")).toHaveCount(3);
      await expect(page.locator(`#done a[href="/${locale}/security"]`)).toBeVisible();
      await expect(page.locator(`footer a[href="/${locale}/security"]`)).toBeVisible();
    });

    test("canonical and hreflang metadata", async ({ page }) => {
      await page.goto(`/${locale}/guide`);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${locale}/guide$`));
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(4);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{40,}/);
    });

    test("no horizontal scroll at 390px and touch targets are 44px", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 780 });
      await page.goto(`/${locale}/guide`);
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
      await page.goto(`/${locale}/guide`);
      await page.waitForLoadState("networkidle");
      expect(await a11yIssues(page)).toEqual([]);
      await expectNoAxeViolations(page, testInfo);
    });
  });
}

test("print version hides site chrome and shows the guide", async ({ page }) => {
  await page.goto("/hy/guide");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("header").first()).toBeHidden();
  await expect(page.locator("footer")).toBeHidden();
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByRole("button", { name: /PDF/ })).toBeHidden();
});

test("keyboard: contents links jump to their section", async ({ page }) => {
  await page.goto("/en/guide");
  await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "How to use it" }).click();
  await expect(page).toHaveURL(/#how$/);
  await expect(page.locator("#how-h")).toBeInViewport();
});
