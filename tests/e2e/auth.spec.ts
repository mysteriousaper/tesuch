import { expect, test } from "@playwright/test";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { a11yIssues, trackErrors } from "./helpers/page-checks";
import { admin, createTestUser, deleteTestUsers, type TestUser } from "./helpers/supabase";

test.describe("authentication and onboarding", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");

  const users: TestUser[] = [];
  test.afterAll(async () => deleteTestUsers(users.map((u) => u.id)));

  test("unauthenticated /app redirects to login", async ({ page }) => {
    await page.goto("/hy/app");
    await expect(page).toHaveURL(/\/hy\/login$/);
  });

  test("wrong code shows an error and keeps the user on login", async ({ page }) => {
    const user = await createTestUser("badcode");
    users.push(user);
    await page.route("**/auth/v1/otp**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto("/en/login");
    await page.locator("#email").fill(user.email);
    await page.locator('form button[type="submit"]').click();
    await page.locator("#code").fill("000000");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator("p[role=alert]")).toContainText("wrong or expired");
    await expect(page).toHaveURL(/\/en\/login$/);
  });

  test("login link failure message is shown (?error=1)", async ({ page }) => {
    await page.goto("/hy/login?error=1");
    await expect(page.locator("p[role=alert]")).toContainText("Մուտքը չհաջողվեց");
  });

  test("sign in with code → create firm → notifications card → sign out", async ({ page }) => {
    const errors = trackErrors(page);
    const user = await createTestUser("flow");
    users.push(user);

    await signInViaUi(page, user, "en");
    await expect(page.getByRole("heading", { level: 1, name: "Create your firm" })).toBeVisible();
    expect(await a11yIssues(page)).toEqual([]);

    const firm = `QA Firm ${Date.now()}`;
    await page.getByLabel("Firm name").fill(firm);
    await page.getByRole("button", { name: "Create" }).click();
    // Dashboard shows the new firm as its title.
    await expect(page.getByRole("heading", { level: 1, name: firm })).toBeVisible();

    // The firm exists in the database with this user as owner.
    const { data: m } = await admin().from("memberships").select("role, orgs(name)").eq("user_id", user.id);
    expect(m).toEqual([{ role: "owner", orgs: { name: firm } }]);

    // Notifications card lives in Settings: Telegram not linked yet, own email shown, test button present.
    await page.getByRole("navigation", { name: "App" }).getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText("Not connected")).toBeVisible();
    await expect(page.getByText(`Email: ${user.email}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect Telegram" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send a test alert" })).toBeEnabled();

    // App navigation is present.
    const nav = page.getByRole("navigation", { name: "App" });
    for (const label of ["Dashboard", "Import", "Documents", "Quiz", "Settings"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
    await page.goto("/en/app");
    await expect(page).toHaveURL(/\/en\/login$/);
    expect(errors, "console errors").toEqual([]);
  });

  test("Armenian UI after sign-in", async ({ page }) => {
    const user = await createTestUser("hy");
    users.push(user);
    await signInViaUi(page, user, "hy");
    await expect(page.locator("html")).toHaveAttribute("lang", "hy");
    await expect(page.getByRole("heading", { level: 1, name: "Ստեղծեք ձեր ֆիրման" })).toBeVisible();
  });

  test("a second firm name is not created for blank input", async ({ page }) => {
    const user = await createTestUser("blank");
    users.push(user);
    await signInViaUi(page, user, "en");
    await page.getByLabel("Firm name").fill("   ");
    await page.getByRole("button", { name: "Create" }).click();
    const { data } = await admin().from("memberships").select("org_id").eq("user_id", user.id);
    expect(data).toEqual([]);
  });
});
