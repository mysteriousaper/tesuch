import { expect, test } from "@playwright/test";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { seedDocsFixture, type DocsFixture } from "./helpers/lane-c";
import { trackErrors } from "./helpers/page-checks";
import { admin, createTestUser, deleteTestUsers, type TestUser } from "./helpers/supabase";

test.describe("findings list: grouping, filters, paging (M-9)", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");
  let user: TestUser;
  let fx: DocsFixture;

  test.beforeAll(async () => {
    user = await createTestUser("findlist");
    fx = await seedDocsFixture(user, "FindList");
    // 60 employees named "Pager NN", each with one open amber finding of the same rule, plus 2 red ones of another rule.
    const db = admin();
    const emps = await db.from("employees").insert(
      Array.from({ length: 60 }, (_, i) => ({ org_id: fx.orgId, company_id: fx.companyId, full_name: `Pager ${String(i + 1).padStart(2, "0")}` })),
    ).select("id, full_name");
    expect(emps.error).toBeNull();
    const rows = emps.data!.map((e, i) => ({
      org_id: fx.orgId, company_id: fx.companyId, employee_id: e.id,
      rule_id: i < 2 ? "probation-max" : "src-registration", rule_version: 1, severity: i < 2 ? "red" : "amber", due_date: `2099-01-${String((i % 28) + 1).padStart(2, "0")}`,
    }));
    const ins = await db.from("findings").insert(rows);
    expect(ins.error).toBeNull();
  });
  test.afterAll(async () => deleteTestUsers([user?.id].filter(Boolean)));

  test("pages at 50, groups by rule, filters by type and by employee, ignores junk filters", async ({ page }) => {
    const errors = trackErrors(page);
    await signInViaUi(page, user, "en");
    const base = `/en/app/companies/${fx.companyId}`;
    await page.goto(base);
    const items = page.locator("section[aria-labelledby=findings-h] section > ul > li");
    await expect(items).toHaveCount(50);
    // red first (ordered by type), grouped under their rule heading with a count
    await expect(page.locator("section[aria-labelledby=findings-h] h3").first()).toContainText("(2)");
    await expect(page.getByText("Page 1 of 2")).toBeVisible();

    await page.getByRole("link", { name: "Next →" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(items).toHaveCount(11); // 60 seeded + the fixture's own informational finding = 61
    await expect(page.getByText("Page 2 of 2")).toBeVisible();

    // filter by type
    await page.goto(`${base}?sev=red`);
    await expect(items).toHaveCount(2);
    // filter by employee name
    await page.goto(base);
    await page.getByRole("searchbox", { name: "Employee" }).fill("Pager 07");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/q=Pager/);
    await expect(items).toHaveCount(1);
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(items).toHaveCount(50);

    // junk filters are ignored, not errors
    const bad = await page.goto(`${base}?sev=drop%20table&page=-5&q=%25%25%2C()`);
    expect(bad?.status()).toBe(200);
    await expect(items).toHaveCount(50);
    expect(errors, "console errors").toEqual([]);
  });
});
