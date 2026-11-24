import { expect, test } from "@playwright/test";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { seedDocsFixture, type DocsFixture } from "./helpers/lane-c";
import { trackErrors } from "./helpers/page-checks";
import { admin, createTestUser, deleteTestUsers, type TestUser } from "./helpers/supabase";

test.describe("owner home for a single business (S-2)", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");
  test.describe.configure({ mode: "serial" });

  let user: TestUser;
  let fx: DocsFixture;

  test.beforeAll(async () => {
    user = await createTestUser("ownerhome");
    fx = await seedDocsFixture(user, "OwnerHome");
  });
  test.afterAll(async () => deleteTestUsers([user?.id].filter(Boolean)));

  test("status in words, no task for info-only items, and the inspector pack downloads", async ({ page }) => {
    const errors = trackErrors(page);
    await signInViaUi(page, user, "en");
    await expect(page.getByTestId("readiness-status")).toHaveAttribute("data-status", "clear");
    await expect(page.getByTestId("readiness-status")).toHaveText("No known issues in what Tesuch checks");
    await expect(page.getByTestId("coverage-summary")).toHaveText(/^Tesuch checks \d+ areas$/);
    await page.getByTestId("coverage-summary").click();
    await expect(page.getByTestId("rules-reviewed")).toHaveText("Rules not yet reviewed by a lawyer");
    await expect(page.getByTestId("coverage-disclaimer")).toContainText("Not a guarantee of the inspection result");
    await expect(page.getByTestId("checklist-coverage")).toHaveText(/checks, in part, 12 of 102 items of the official labour inspection checklist/);
    await expect(page.getByTestId("documents-summary")).toHaveText(/^Documents to have ready \(\d+ of 90\)$/);
    // the only open finding is informational, so there is nothing to do this week
    await expect(page.locator("#tasks-h")).toHaveText("Do this week");
    await expect(page.getByText("Nothing to do this week.")).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("inspector-here").click()]);
    const path = await download.path();
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync(path);
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1500);
    expect(errors, "console errors").toEqual([]);
  });

  test("a real issue becomes one plain task with the employee and due date", async ({ page }) => {
    const db = admin();
    const { data: emp } = await db.from("employees").select("id, full_name").eq("company_id", fx.companyId).order("full_name").limit(1).single();
    const ins = await db.from("findings").insert({
      org_id: fx.orgId, company_id: fx.companyId, employee_id: emp!.id, rule_id: "probation-max", rule_version: 1, severity: "advisory", due_date: "2099-01-01",
    });
    expect(ins.error).toBeNull();
    await signInViaUi(page, user, "en");
    await expect(page.locator('section[aria-labelledby="tasks-h"] li')).toHaveCount(1);
    await expect(page.locator('section[aria-labelledby="tasks-h"] li').first()).toContainText("Probation exceeds the legal maximum");
    await expect(page.locator('section[aria-labelledby="tasks-h"] li').first()).toContainText(emp!.full_name);
    await expect(page.locator('section[aria-labelledby="tasks-h"] li').first()).toContainText("by 01.01.2099");
  });

  test("serious overdue issues turn the status to Risk", async ({ page }) => {
    const db = admin();
    const { data: emp } = await db.from("employees").select("id").eq("company_id", fx.companyId).limit(1).single();
    const rows = ["fixed-term-ground", "notice-period", "termination-ground"].map((rule_id) => ({
      org_id: fx.orgId, company_id: fx.companyId, employee_id: emp!.id, rule_id, rule_version: 1, severity: "red", due_date: "2020-01-01",
    }));
    const ins = await db.from("findings").insert(rows);
    expect(ins.error).toBeNull();
    await signInViaUi(page, user, "en");
    await expect(page.getByTestId("readiness-status")).toHaveAttribute("data-status", "risk");
    await expect(page.locator('section[aria-labelledby="tasks-h"] li')).toHaveCount(3);
  });

  test("shows when the data was last updated and nudges after 90 days", async ({ page }) => {
    await signInViaUi(page, user, "en");
    await expect(page.getByTestId("data-updated")).toContainText("Data last updated");
    await expect(page.getByTestId("data-stale")).toHaveCount(0);

    const old = new Date(Date.now() - 100 * 86_400_000).toISOString();
    const db = admin();
    const { data: emps } = await db.from("employees").select("id").eq("company_id", fx.companyId);
    const ids = (emps ?? []).map((e) => e.id);
    expect((await db.from("employees").update({ created_at: old }).in("id", ids)).error).toBeNull();
    expect((await db.from("contracts").update({ created_at: old }).in("employee_id", ids)).error).toBeNull();
    expect((await db.from("leave_records").update({ created_at: old }).in("employee_id", ids)).error).toBeNull();
    await page.goto("/en/app");
    await expect(page.getByTestId("data-stale")).toContainText("Your data is 100 days old");
    await expect(page.getByTestId("data-stale").getByRole("link", { name: "Update staff data" })).toHaveAttribute("href", /\/app\/import$/);
  });

  test("two companies keep the firm dashboard; ?view=firm is the advanced view", async ({ page }) => {
    await signInViaUi(page, user, "en");
    await page.getByRole("link", { name: "All companies and details" }).click();
    await expect(page).toHaveURL(/view=firm/);
    await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible();
    await page.getByRole("link", { name: "Back to the simple view" }).click();
    await expect(page.getByTestId("readiness-status")).toBeVisible();

    const second = await admin().from("companies").insert({ org_id: fx.orgId, name: "Second Co" }).select("id").single();
    expect(second.error).toBeNull();
    await page.goto("/en/app");
    await expect(page.getByTestId("readiness-status")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible();
  });
});
