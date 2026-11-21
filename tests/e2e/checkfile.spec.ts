import { expect, test, type Page, type Request } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/a11y";
import { a11yIssues, expectNoHorizontalScroll, trackErrors } from "./helpers/page-checks";

const LOCALES = ["hy", "ru", "en"] as const;
const MARK = "ZQXMARK";

// Probation of eight months for a regular contract: a rule must fire. Codes carry a marker we can search for.
const CSV = [
  "Employee code,Start date,Probation end,Contract type",
  `${MARK}-001,10.01.2024,10.09.2024,indefinite`,
  `${MARK}-002,15.03.2023,,indefinite`,
].join("\n");

function watchRequests(page: Page) {
  const seen: { method: string; url: string; body: string }[] = [];
  page.on("request", (r: Request) => seen.push({ method: r.method(), url: r.url(), body: r.postData() ?? "" }));
  return seen;
}

for (const locale of LOCALES) {
  test.describe(`file check /${locale}/check-file`, () => {
    test("shows status and issues, and nothing carrying the file leaves the browser", async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`/${locale}/check-file`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.getByTestId("no-upload-note")).toBeVisible();
      await page.waitForLoadState("networkidle");

      const seen = watchRequests(page);
      await page.locator('input[type="file"]').setInputFiles({ name: "staff.csv", mimeType: "text/csv", buffer: Buffer.from(CSV, "utf8") });
      await expect(page.getByTestId("file-result")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("status")).toHaveText(/\S/);
      // The probation rule found the first employee; the code (not a name) is shown.
      await expect(page.getByTestId("file-result")).toContainText(`${MARK}-001`);
      await expect(page.locator(`main a[href="/${locale}/login"]`).first()).toBeVisible();
      await page.waitForTimeout(500);

      // No request carries the file contents, and nothing was sent with a body at all.
      for (const r of seen) {
        expect(r.url, r.url).not.toContain(MARK);
        expect(r.body, r.url).not.toContain(MARK);
        expect(r.method === "GET" || r.method === "HEAD", `${r.method} ${r.url}`).toBe(true);
        expect(r.body, r.url).toBe("");
      }
      expect(errors, "console errors").toEqual([]);
    });

    test("a file without a start-date column gets a plain error", async ({ page }) => {
      await page.goto(`/${locale}/check-file`);
      await page.locator('input[type="file"]').setInputFiles({ name: "x.csv", mimeType: "text/csv", buffer: Buffer.from("Foo,Bar\n1,2\n", "utf8") });
      await expect(page.locator("p[role=alert]")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("file-result")).toHaveCount(0);
    });

    test("canonical, hreflang, no horizontal scroll and accessibility", async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 390, height: 780 });
      await page.goto(`/${locale}/check-file`);
      await page.waitForLoadState("networkidle");
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${locale}/check-file$`));
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(4);
      await expectNoHorizontalScroll(page);
      expect(await a11yIssues(page)).toEqual([]);
      await expectNoAxeViolations(page, testInfo);
    });
  });
}

test("sitemap lists /check-file and the landing links to it", async ({ request, page }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const l of LOCALES) expect(xml).toContain(`/${l}/check-file`);
  await page.goto("/en");
  await expect(page.locator('main a[href="/en/check-file"]').first()).toBeVisible();
});
