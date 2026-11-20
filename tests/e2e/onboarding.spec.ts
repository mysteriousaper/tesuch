import { expect, test } from "@playwright/test";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { a11yIssues, trackErrors } from "./helpers/page-checks";
import { admin, createTestUser, deleteTestUsers, type TestUser } from "./helpers/supabase";

test.describe("3-step onboarding for a new business (S-3)", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");
  const users: TestUser[] = [];
  test.afterAll(async () => deleteTestUsers(users.map((u) => u.id)));

  test("business name → company created → three steps → upload → Telegram is the next step", async ({ page }) => {
    const errors = trackErrors(page);
    const user = await createTestUser("onboard");
    users.push(user);
    await signInViaUi(page, user, "en");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome to Tesuch" })).toBeVisible();

    const name = `QA Bakery ${Date.now()}`;
    await page.getByLabel("What is your business called?").fill(name);
    await page.getByRole("button", { name: "Start" }).click();

    // The company exists already, named after the business; the owner never typed "company".
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    const { data: cos } = await admin().from("companies").select("name").eq("org_id", (await admin().from("memberships").select("org_id").eq("user_id", user.id).single()).data!.org_id);
    expect(cos).toEqual([{ name }]);

    // Three steps, state in words. Step 1 is now; 2 and 3 are next.
    const steps = page.getByTestId("onboarding-steps");
    await expect(steps.locator("li")).toHaveCount(3);
    await expect(steps.locator('li[data-step="1"]')).toHaveAttribute("data-state", "now");
    await expect(steps.locator('li[data-step="2"]')).toHaveAttribute("data-state", "next");
    await expect(steps.locator('li[data-step="3"]')).toHaveAttribute("data-state", "next");
    await expect(page.getByTestId("readiness-status")).toHaveAttribute("data-status", "none");
    expect(await a11yIssues(page)).toEqual([]);

    // Step 1 → the import wizard already has the company selected; step 2 is its preview-and-confirm.
    await steps.getByRole("link", { name: "Upload staff list" }).click();
    await expect(page).toHaveURL(/\/en\/app\/import$/);
    const csv = ["Name,Start date", "Baker One,01.09.2026", "Baker Two,01.10.2026"].join("\n");
    await page.getByLabel("File (.csv, .xlsx)").setInputFiles({ name: "staff.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Import (2)" }).click();
    await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible({ timeout: 30_000 });

    // Back home: status is real now, steps 1 and 2 are done, Telegram is the one step left.
    await page.goto("/en/app");
    await expect(page.getByTestId("readiness-status")).not.toHaveAttribute("data-status", "none");
    await expect(page.locator('li[data-step="1"]')).toHaveAttribute("data-state", "done");
    await expect(page.locator('li[data-step="3"]')).toHaveAttribute("data-state", "now");
    await expect(page.getByRole("button", { name: "Connect Telegram" })).toBeVisible();
    expect(errors, "console errors").toEqual([]);
  });

  test("Armenian onboarding copy", async ({ page }) => {
    const user = await createTestUser("onboardhy");
    users.push(user);
    await signInViaUi(page, user, "hy");
    await page.getByLabel("Ինչպե՞ս է կոչվում Ձեր բիզնեսը").fill("QA Հացատուն");
    await page.getByRole("button", { name: "Սկսել" }).click();
    await expect(page.getByText("Պատրաստվեք 3 քայլով")).toBeVisible();
    await expect(page.getByText("Ավելացրեք աշխատակիցներին").first()).toBeVisible();
  });
});
