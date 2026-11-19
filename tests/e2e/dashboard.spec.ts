import { expect, test, type Page } from "@playwright/test";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { a11yIssues, expectNoHorizontalScroll, trackErrors } from "./helpers/page-checks";
import { admin, clientAs, createTestUser, deleteTestUsers, type TestUser } from "./helpers/supabase";

const FIRM = "QA Dashboard Firm";

/** Score shown by the gauge on the current page ("<label>: N/100"). */
async function gaugeScore(page: Page, label: string): Promise<number> {
  const aria = await page.getByRole("img", { name: new RegExp(`^${label}: \\d+/100$`) }).getAttribute("aria-label");
  return Number(/(\d+)\/100$/.exec(aria ?? "")?.[1]);
}

test.describe("dashboard (lane A)", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");
  test.describe.configure({ mode: "serial" });

  let user: TestUser;
  let orgId: string;

  test.beforeAll(async () => {
    user = await createTestUser("dash");
    const { data, error } = await (await clientAs(user)).rpc("create_org", { p_name: FIRM });
    expect(error).toBeNull();
    orgId = data as string;
  });
  test.afterAll(async () => deleteTestUsers([user?.id].filter(Boolean)));

  test("empty firm → load demo data → companies sorted riskiest first", async ({ page }) => {
    const errors = trackErrors(page);
    await signInViaUi(page, user, "en");
    await expect(page.getByRole("heading", { level: 1, name: FIRM })).toBeVisible();
    await expect(page.getByText(/No companies yet/)).toBeVisible();

    await page.getByRole("button", { name: "Load demo data" }).click();
    await expect(page.getByText("Demo data loaded.")).toBeVisible({ timeout: 45_000 });

    const { count } = await admin().from("companies").select("id", { count: "exact", head: true }).eq("org_id", orgId);
    expect(count).toBe(5);
    const { count: findings } = await admin().from("findings").select("id", { count: "exact", head: true }).eq("org_id", orgId);
    expect(findings, "demo data should produce findings").toBeGreaterThan(0);

    await page.reload();
    const scores = await page.locator("main ul li a span[aria-label$='/100']").evaluateAll((els) => els.map((e) => Number(e.textContent)));
    expect(scores).toHaveLength(5);
    expect(scores, "riskiest (lowest score) first").toEqual([...scores].sort((a, b) => a - b));
    await expect(page.getByRole("img", { name: /^Firm average score: \d+\/100$/ })).toBeVisible();

    await expectNoHorizontalScroll(page);
    expect(await a11yIssues(page)).toEqual([]);
    expect(errors, "console errors").toEqual([]);
  });

  test("company page: fix and dismiss findings, re-check keeps decisions honest", async ({ page }) => {
    const errors = trackErrors(page);
    await signInViaUi(page, user, "en");
    // Open the riskiest company: it has the most open findings to work with.
    const firstCompany = page.locator("main ul li a").first();
    const companyName = (await firstCompany.locator("span").first().textContent())!.trim();
    await firstCompany.click();
    await expect(page.getByRole("heading", { level: 1, name: companyName })).toBeVisible();

    const findingsList = page.locator("section[aria-labelledby=findings-h] > div > ul").first();
    const openBefore = await findingsList.locator(":scope > li").count();
    expect(openBefore, "riskiest demo company has at least 2 open findings").toBeGreaterThanOrEqual(2);
    const scoreBefore = await gaugeScore(page, "Inspection readiness");

    // Every finding cites its source and shows the advisory disclaimer (all rules are unverified).
    await expect(findingsList.locator(":scope > li").first().getByRole("link", { name: "arlis.am" })).toHaveAttribute("href", /^https:\/\/www\.arlis\.am\//);
    await expect(page.getByText(/not legal advice/).first()).toBeVisible();

    const titleOf = async (i: number) => (await findingsList.locator(":scope > li").nth(i).locator("p").first().textContent())!.trim();
    const fixedTitle = await titleOf(0);
    await findingsList.locator(":scope > li").first().getByRole("button", { name: "Mark fixed" }).click();
    await expect(findingsList.locator(":scope > li")).toHaveCount(openBefore - 1);

    const dismissedTitle = await titleOf(0);
    await findingsList.locator(":scope > li").first().getByRole("button", { name: "Dismiss" }).click();
    await expect(findingsList.locator(":scope > li")).toHaveCount(openBefore - 2);
    await expect(page.getByText("Closed issues (2)")).toBeVisible();

    // Score never drops when issues are closed.
    expect(await gaugeScore(page, "Inspection readiness")).toBeGreaterThanOrEqual(scoreBefore);

    // DB: one fixed, one dismissed, resolver recorded.
    const { data: closed } = await admin().from("findings").select("status, resolved_by").eq("org_id", orgId).neq("status", "open");
    expect(closed?.map((f) => f.status).sort()).toEqual(["dismissed", "fixed"]);
    expect(closed?.every((f) => f.resolved_by === user.id)).toBe(true);

    // Re-check: the data behind the "fixed" finding didn't change, so the rule still fires and it reopens.
    // The dismissed one stays dismissed (a human decision).
    await page.getByRole("button", { name: "Re-check now" }).click();
    await expect(page.getByText(/^Checked\. Open issues: \d+\.$/)).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByText("Closed issues (1)")).toBeVisible();
    await expect(findingsList.locator(":scope > li").filter({ hasText: fixedTitle }).first()).toBeVisible();
    await page.getByText("Closed issues (1)").click();
    await expect(page.locator("details li").filter({ hasText: dismissedTitle })).toContainText("Dismissed");
    expect(errors, "console errors").toEqual([]);
  });

  test("employee timeline shows contract events and today marker", async ({ page }) => {
    const errors = trackErrors(page);
    await signInViaUi(page, user, "en");
    await page.locator("main ul li a").first().click();
    const employeeLink = page.locator("section[aria-labelledby=findings-h] li").first().locator('a[href*="/employees/"]').first();
    const name = (await employeeLink.textContent())!.trim();
    await employeeLink.click();

    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
    const timeline = page.locator("section[aria-labelledby=timeline-h] ol");
    await expect(timeline.locator("li[aria-current=date]")).toContainText("Today");
    await expect(timeline).toContainText("Started work");
    // Events are in date order.
    const dates = await timeline.locator("time").evaluateAll((els) => els.map((e) => e.getAttribute("datetime")!));
    expect(dates).toEqual([...dates].sort());
    await expectNoHorizontalScroll(page);
    expect(await a11yIssues(page)).toEqual([]);
    expect(errors, "console errors").toEqual([]);
  });

  test("another firm's company page is not reachable by URL", async ({ page }) => {
    const { data: co } = await admin().from("companies").select("id").eq("org_id", orgId).limit(1).single();
    const outsider = await createTestUser("dash-outsider");
    try {
      await signInViaUi(page, outsider, "en");
      const res = await page.goto(`/en/app/companies/${co!.id}`);
      expect(res?.status()).toBe(404);
      await expect(page.getByText(/QA Dashboard|Demo/)).toHaveCount(0);
    } finally {
      await deleteTestUsers([outsider.id]);
    }
  });
});
