import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { seedDocsFixture, type DocsFixture } from "./helpers/lane-c";
import { expectNoHorizontalScroll, trackErrors } from "./helpers/page-checks";
import { createTestUser, deleteTestUsers, type TestUser } from "./helpers/supabase";

test.describe("documents and quiz (lane C)", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");
  test.describe.configure({ mode: "serial" });

  let user: TestUser;
  let fx: DocsFixture;

  test.beforeAll(async () => {
    user = await createTestUser("docs");
    fx = await seedDocsFixture(user, "Docs");
  });
  test.afterAll(async () => deleteTestUsers([user?.id].filter(Boolean)));

  test("documents page downloads the checklist and a contract document as real PDFs", async ({ page }) => {
    const errors = trackErrors(page);
    await signInViaUi(page, user, "hy");
    await page.goto("/hy/app/documents");
    await expect(page.getByRole("heading", { level: 1, name: "Փաստաթղթեր" })).toBeVisible();

    // Only the documents that apply: probation orders and the end notice for the fixed-term contract, not for the other.
    await expect(page.locator(`a[href*="probation?contract=${fx.contractId}"]`)).toHaveCount(2);
    await expect(page.locator(`a[href*="fixed-term-end?contract=${fx.dismissalContractId}"]`)).toHaveCount(0);

    for (const link of [
      page.locator(`a[href^="/api/pdf/checklist?company=${fx.companyId}"]`),
      page.locator(`a[href*="probation?contract=${fx.contractId}&decision=confirm"]`),
    ]) {
      const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
      // The saved name may carry the employee's name (filename*), which headless Chromium reports as "download";
      // the ASCII fallback in the header is what we can check reliably.
      const header = (await page.request.get((await link.getAttribute("href"))!)).headers()["content-disposition"];
      expect(header).toMatch(/filename="tesuch-[a-z-]+-[0-9a-f]{8}-\d{4}-\d{2}-\d{2}\.pdf"/);
      const bytes = readFileSync((await download.path())!);
      expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
      // Armenian glyphs come from the embedded Noto Sans Armenian subset.
      expect(bytes.toString("latin1")).toContain("NotoSansArmenian");
    }

    // The dismissal form (GET → attachment) downloads too.
    const form = page.locator(`form[action="/api/pdf/dismissal"]:has(input[value="${fx.dismissalContractId}"])`);
    const [dismissal] = await Promise.all([page.waitForEvent("download"), form.getByRole("button").click()]);
    // Headless Chromium reports "download" when the header carries a UTF-8 filename* (employee name, M-16).
    expect(dismissal.suggestedFilename()).toMatch(/^(tesuch-dismissal-.*\.pdf|download)$/);

    expect(errors).toEqual([]);
  });

  test("weekly quiz: answer, see result with citations and the streak panel; one attempt per week", async ({ page }) => {
    const errors = trackErrors(page);
    await signInViaUi(page, user, "hy");
    await page.goto("/hy/app/quiz");
    const questions = page.locator("fieldset");
    await expect(questions).toHaveCount(5);
    // The answer key never reaches the browser.
    expect(await page.content()).not.toContain('"correct"');

    const finish = page.getByRole("button", { name: "Ավարտել" });
    await expect(finish).toBeEnabled(); // disabled until hydrated
    await finish.click();
    await expect(page.locator("form [role=alert]")).toContainText("Պատասխանեք");

    for (let i = 0; i < 5; i++) await questions.nth(i).locator('input[type="radio"]').first().check();
    await finish.click();

    await expect(page.getByText(/Արդյունք՝ \d\/5/)).toBeVisible();
    await expect(page.locator('a[href^="https://www.arlis.am/"]')).toHaveCount(5);
    const streak = page.getByRole("complementary", { name: "Ընթացիկ շարք" });
    await expect(streak).toBeVisible();
    await expect(streak.getByText("Կրծքանշաններ")).toBeVisible();

    // Second visit this week: result, not a new form.
    await page.reload();
    await expect(page.locator("fieldset")).toHaveCount(0);
    await expect(page.getByText(/Արդյունք՝ \d\/5/)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalScroll(page);
    expect(errors).toEqual([]);
  });
});
