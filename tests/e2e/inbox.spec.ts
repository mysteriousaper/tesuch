import { expect, test } from "@playwright/test";
import { toRuleRow } from "../../src/lib/jobs/mappers";
import { RULES } from "../../src/lib/rules/catalog";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { a11yIssues, expectNoHorizontalScroll, trackErrors } from "./helpers/page-checks";
import { admin, clientAs, createTestUser, deleteTestUsers, type TestUser, keepNames } from "./helpers/supabase";

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** F1 firm deadline inbox: cross-company list, window filter, overdue group, paging, tenancy, viewer. Uses the user's RLS session through the UI. */
test.describe("deadline inbox (F1)", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");
  test.describe.configure({ mode: "serial" });

  let owner: TestUser, viewer: TestUser, other: TestUser;
  let orgId: string;
  let coA: string, coB: string;
  let hasAssignee = false;
  const ids: string[] = [];

  async function addFindings(org: string, company: string, tag: string, specs: { due: number; severity: "red" | "amber" | "advisory" | "info" }[]) {
    const db = admin();
    const emps = await db.from("employees").insert(specs.map((_, i) => ({ org_id: org, company_id: company, full_name: `${tag} ${String(i).padStart(2, "0")}` }))).select("id, full_name").order("full_name");
    expect(emps.error).toBeNull();
    const rows = emps.data!.map((e, i) => ({
      org_id: org, company_id: company, employee_id: e.id, rule_id: "probation-max", rule_version: 1,
      severity: specs[i].severity, due_date: iso(specs[i].due),
    }));
    const f = await db.from("findings").insert(rows).select("id");
    expect(f.error).toBeNull();
  }

  test.beforeAll(async () => {
    [owner, viewer, other] = await Promise.all([createTestUser("inbox-o"), createTestUser("inbox-v"), createTestUser("inbox-x")]);
    ids.push(owner.id, viewer.id, other.id);
    const db = admin();
    await db.from("rules").upsert(RULES.map(toRuleRow), { onConflict: "id,version", ignoreDuplicates: true });
    hasAssignee = !(await db.from("findings").select("assignee_id").limit(1)).error;

    const asOwner = await clientAs(owner);
    const { data, error } = await asOwner.rpc("create_org", { p_name: "QA Inbox Firm" });
    expect(error).toBeNull();
    orgId = data as string;
    await keepNames(orgId);
    await db.from("memberships").insert({ user_id: viewer.id, org_id: orgId, role: "viewer" });
    const cos = await db.from("companies").insert([{ org_id: orgId, name: "QA Inbox Alpha" }, { org_id: orgId, name: "QA Inbox Beta" }]).select("id, name").order("name");
    expect(cos.error).toBeNull();
    [coA, coB] = cos.data!.map((c) => c.id as string);

    // Alpha: 1 overdue, 1 due in 3 days, 1 in 20 days, 1 info (never shown). Beta: 1 in 60 days.
    await addFindings(orgId, coA, "Alpha", [{ due: -5, severity: "red" }, { due: 3, severity: "amber" }, { due: 20, severity: "advisory" }, { due: 1, severity: "info" }]);
    await addFindings(orgId, coB, "Beta", [{ due: 60, severity: "advisory" }]);

    // Another firm with its own finding: must never show up for the owner.
    const asOther = await clientAs(other);
    const o = await asOther.rpc("create_org", { p_name: "QA Inbox Other" });
    const coX = await db.from("companies").insert({ org_id: o.data as string, name: "QA Secret Co" }).select("id").single();
    await addFindings(o.data as string, coX.data!.id as string, "Secret", [{ due: -1, severity: "red" }]);
  });
  test.afterAll(async () => deleteTestUsers(ids));

  test("lists open findings of all companies, overdue first in its own group, advisory keeps its line", async ({ page }) => {
    const errors = trackErrors(page);
    await signInViaUi(page, owner, "en");
    await page.getByRole("link", { name: "Inbox", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/app\/inbox$/);
    await expect(page.getByRole("heading", { level: 1, name: "Deadline inbox" })).toBeVisible();
    await expect(page.getByTestId("inbox-total")).toHaveText("4 open findings");
    const rows = page.getByRole("table").getByTestId("inbox-row");
    await expect(rows).toHaveCount(4);
    await expect(page.getByRole("table").getByTestId("inbox-group-overdue").getByTestId("inbox-row")).toHaveCount(1);
    await expect(page.getByRole("table").getByTestId("inbox-group-overdue")).toContainText("Alpha 00");
    const names = await rows.locator("td:nth-child(3)").allTextContents();
    expect(names.map((n) => n.trim())).toEqual(["Alpha 00", "Alpha 01", "Alpha 02", "Beta 00"]);
    await expect(page.getByText("This is not legal advice").first()).toBeVisible();
    await expect(page.getByText("Secret")).toHaveCount(0);
    expect(await a11yIssues(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("window filter and company filter", async ({ page }) => {
    await signInViaUi(page, owner, "en");
    await page.goto("/en/app/inbox?window=7");
    await expect(page.getByTestId("inbox-total")).toHaveText("2 open findings");
    await page.goto("/en/app/inbox?window=30");
    await expect(page.getByTestId("inbox-total")).toHaveText("3 open findings");
    await page.getByLabel("Company").selectOption({ label: "QA Inbox Beta" });
    await expect(page).toHaveURL(/company=/);
    await expect(page.getByText("No open findings match these filters.")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByTestId("inbox-total")).toHaveText("4 open findings");
  });

  test("mobile 390px: cards, no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await signInViaUi(page, owner, "en");
    await page.goto("/en/app/inbox");
    await expect(page.locator("ul li[data-testid=inbox-row]")).toHaveCount(4);
    await expect(page.getByRole("table")).toBeHidden();
    await expectNoHorizontalScroll(page);
  });

  test("viewer sees the list without assign controls", async ({ page }) => {
    await signInViaUi(page, viewer, "en");
    await page.goto("/en/app/inbox");
    await expect(page.getByTestId("inbox-total")).toHaveText("4 open findings");
    await expect(page.getByRole("combobox", { name: /^Assignee for/ })).toHaveCount(0);
  });

  test("other firm sees only its own finding", async ({ page }) => {
    await signInViaUi(page, other, "en");
    await page.goto("/en/app/inbox");
    await expect(page.getByTestId("inbox-total")).toHaveText("1 open finding");
    await expect(page.getByText("Alpha 00")).toHaveCount(0);
  });

  test("pages at 50 rows with an exact count", async ({ page }) => {
    await addFindings(orgId, coB, "Bulk", Array.from({ length: 52 }, (_, i) => ({ due: 100 + i, severity: "advisory" as const })));
    await signInViaUi(page, owner, "en");
    await page.goto("/en/app/inbox");
    await expect(page.getByTestId("inbox-total")).toHaveText("56 open findings");
    await expect(page.getByRole("table").getByTestId("inbox-row")).toHaveCount(50);
    await page.getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole("table").getByTestId("inbox-row")).toHaveCount(6);
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
  });

  test("assign a colleague (needs migration 20261121100000 on the target database)", async ({ page }) => {
    test.skip(!hasAssignee, "findings.assignee_id not present: migration not applied to this database yet");
    await signInViaUi(page, owner, "en");
    await page.goto("/en/app/inbox?window=7");
    const pick = page.getByRole("table").getByRole("combobox", { name: /^Assignee for/ }).first();
    await pick.selectOption({ index: 1 });
    await expect.poll(async () => (await admin().from("findings").select("id").eq("org_id", orgId).eq("assignee_id", owner.id)).data?.length ?? 0).toBeGreaterThan(0);
  });
});
