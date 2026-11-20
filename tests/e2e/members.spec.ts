import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { a11yIssues, expectNoHorizontalScroll, trackErrors } from "./helpers/page-checks";
import { admin, clientAs, createTestUser, deleteTestUsers, emailOtp, type TestUser, keepNames } from "./helpers/supabase";

/**
 * Engineering: team page, invitations, audit viewer, data export/delete.
 * Invitation tests need migration 20261119020000_members.sql; they skip (with a reason) until it is applied.
 */
const SHOTS = process.env.E2E_SHOTS_DIR;

async function shoot(page: Page, name: string) {
  if (!SHOTS) return;
  for (const [w, h] of [[390, 844], [1280, 900]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `${SHOTS}/${name}-${w}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

async function invitationsMigrated(): Promise<boolean> {
  const { error } = await admin().from("invitations").select("id").limit(1);
  return !error;
}

test.describe("team, audit and data rights", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");
  test.describe.configure({ mode: "serial" });

  let owner: TestUser, viewer: TestUser, accountant: TestUser, outsider: TestUser;
  let asOwner: SupabaseClient, asOutsider: SupabaseClient;
  let org: string, employee: string, employee2: string, outsiderEmployee: string;

  test.beforeAll(async () => {
    [owner, viewer, accountant, outsider] = await Promise.all([
      createTestUser("eng-owner"), createTestUser("eng-viewer"), createTestUser("eng-acct"), createTestUser("eng-out"),
    ]);
    [asOwner, asOutsider] = await Promise.all([clientAs(owner), clientAs(outsider)]);
    org = (await asOwner.rpc("create_org", { p_name: "QA Eng Firm" })).data as string;
    await keepNames(org);
    // Clients cannot insert memberships (C-1); invitations are covered below, so seed these two as setup.
    const ins = await admin().from("memberships").insert([
      { user_id: viewer.id, org_id: org, role: "viewer" },
      { user_id: accountant.id, org_id: org, role: "accountant" },
    ]);
    expect(ins.error).toBeNull();
    const co = (await asOwner.from("companies").insert({ org_id: org, name: "QA Eng Co" }).select("id").single()).data!.id as string;
    const emps = await asOwner.from("employees").insert([
      { org_id: org, company_id: co, full_name: "Export Person", birth_date: "1990-01-02" },
      { org_id: org, company_id: co, full_name: "Delete Person" },
    ]).select("id, full_name");
    expect(emps.error).toBeNull();
    employee = emps.data!.find((e) => e.full_name === "Export Person")!.id;
    employee2 = emps.data!.find((e) => e.full_name === "Delete Person")!.id;
    expect((await asOwner.from("contracts").insert({ org_id: org, employee_id: employee, type: "indefinite", start_date: "2026-01-10" })).error).toBeNull();
    expect((await asOwner.from("leave_records").insert({ org_id: org, employee_id: employee, type: "annual", start_date: "2026-06-01", days: 10 })).error).toBeNull();

    const oorg = (await asOutsider.rpc("create_org", { p_name: "QA Eng Other" })).data as string;
    const oco = (await asOutsider.from("companies").insert({ org_id: oorg, name: "Other Co" }).select("id").single()).data!.id as string;
    outsiderEmployee = (await asOutsider.from("employees").insert({ org_id: oorg, company_id: oco, full_name: "Other Person" }).select("id").single()).data!.id as string;
  });

  test.afterAll(async () => deleteTestUsers([owner, viewer, accountant, outsider].filter(Boolean).map((u) => u.id)));

  test("owner manages members: list, change role, remove with confirmation", async ({ page }) => {
    const errors = trackErrors(page);
    await signInViaUi(page, owner, "en");
    await page.goto("/en/app/members");
    await expect(page.getByRole("heading", { level: 1, name: "Team" })).toBeVisible();
    const list = page.getByTestId("member-list");
    for (const u of [owner, viewer, accountant]) await expect(list.locator("li", { hasText: u.email })).toBeVisible();
    await expect(list.getByText("only owner")).toBeVisible();
    // Assisted-onboarding card stays hidden while NEXT_PUBLIC_SUPPORT_EMAIL is unset (visible case: unit-tested in lib.test.ts).
    if (!process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()) {
      await expect(page.getByTestId("assisted-invite")).toHaveCount(0);
      await expect(page.getByText("Invite Tesuch to set you up")).toHaveCount(0);
    }
    expect(await a11yIssues(page)).toEqual([]);
    await shoot(page, "members");

    await page.getByLabel(`Role of ${viewer.email}`).selectOption("accountant");
    const row = list.locator("li", { hasText: viewer.email });
    await row.getByRole("button", { name: "Save role" }).click();
    await expect(row.getByText("Saved.")).toBeVisible();
    const { data: m } = await admin().from("memberships").select("role").eq("org_id", org).eq("user_id", viewer.id).single();
    expect(m?.role).toBe("accountant");
    await page.getByRole("button", { name: `Remove ${viewer.email}` }).click();
    const dialog = page.getByRole("dialog", { name: "Remove member?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: `Remove ${viewer.email}` }).click();
    await dialog.getByRole("button", { name: "Remove" }).click();
    await expect(list.getByText(viewer.email, { exact: true })).toBeHidden();
    expect((await admin().from("memberships").select("user_id").eq("org_id", org).eq("user_id", viewer.id)).data).toEqual([]);
    // Restore the viewer for later tests.
    expect((await asOwner.from("memberships").insert({ user_id: viewer.id, org_id: org, role: "viewer" })).error).not.toBeNull();
    expect((await admin().from("memberships").insert({ user_id: viewer.id, org_id: org, role: "viewer" })).error).toBeNull();
    expect(errors).toEqual([]);
  });

  test("viewer sees members but no management controls; audit is owners-only", async ({ page }) => {
    await signInViaUi(page, viewer, "hy");
    await page.goto("/hy/app/members");
    await expect(page.getByRole("heading", { level: 1, name: "Թիմ" })).toBeVisible();
    await expect(page.getByTestId("member-list").locator("li", { hasText: owner.email })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Հրավիրել գործընկերոջ" })).toHaveCount(0);
    await expect(page.locator("select")).toHaveCount(0);
    await page.goto("/hy/app/audit");
    await expect(page.getByText("Մատյանը տեսնում են միայն ընկերության սեփականատերերը։")).toBeVisible();
    await expect(page.getByTestId("audit-rows")).toHaveCount(0);
    expect((await page.request.get("/hy/app/members/data/export")).status()).toBe(403);
  });

  test("audit log: owner sees changes with actor email, filters and paging links", async ({ page }) => {
    const errors = trackErrors(page);
    await signInViaUi(page, owner, "ru");
    await page.goto("/ru/app/audit");
    await expect(page.getByRole("heading", { level: 1, name: "Журнал действий" })).toBeVisible();
    const rows = page.getByTestId("audit-rows");
    await expect(rows.getByText(owner.email).first()).toBeVisible();
    await page.getByLabel("Данные").selectOption("employees");
    await page.getByLabel("Действие").selectOption("insert");
    await page.getByRole("button", { name: "Показать" }).click();
    await page.waitForURL(/table=employees&action=insert/);
    await expect(rows.locator("tr")).toHaveCount(2);
    await expect(rows.getByText(employee)).toBeVisible();
    await expect(rows.getByText("Компании")).toHaveCount(0);
    expect(await a11yIssues(page)).toEqual([]);
    await page.goto("/ru/app/audit");
    await shoot(page, "audit");
    // Untrusted filters are ignored, not passed to the database.
    const bad = await page.goto("/ru/app/audit?table=auth.users&action=drop&page=-5");
    expect(bad?.status()).toBe(200);
    expect(errors).toEqual([]);
  });

  test("data rights: employee export, org export, cross-tenant 404, delete with confirmation", async ({ page }) => {
    await signInViaUi(page, owner, "en");
    const r = await page.request.get(`/en/app/members/data/employees/${employee}`);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-disposition"]).toMatch(/^attachment; filename="tesuch-employee-export-person-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(r.headers()["cache-control"]).toBe("no-store");
    const body = await r.json();
    expect(body).toMatchObject({ format: "tesuch-export", kind: "employee", data: { employee: { id: employee, full_name: "Export Person", birth_date: "1990-01-02" } } });
    expect(body.data.contracts).toHaveLength(1);
    expect(body.data.leave_records).toHaveLength(1);
    expect(Array.isArray(body.data.findings)).toBe(true);

    expect((await page.request.get(`/en/app/members/data/employees/${outsiderEmployee}`)).status()).toBe(404);
    expect((await page.request.get(`/en/app/members/data/employees/not-a-uuid`)).status()).toBe(404);

    const all = await page.request.get("/en/app/members/data/export");
    expect(all.status()).toBe(200);
    const orgData = (await all.json()).data;
    expect(orgData.org.id).toBe(org);
    expect(orgData.employees).toHaveLength(2);
    expect(orgData.members.map((m: { email: string }) => m.email).sort()).toEqual([owner.email, viewer.email, accountant.email].sort());
    expect(JSON.stringify(orgData)).not.toContain("Other Person");

    await page.goto("/en/app/members/data");
    await expect(page.getByRole("heading", { level: 1, name: "Data export and deletion" })).toBeVisible();
    expect(await a11yIssues(page)).toEqual([]);
    await shoot(page, "data");
    await page.getByRole("button", { name: "Delete Delete Person" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete employee for good?" });
    await expect(dialog).toBeVisible();
    await shoot(page, "data-confirm");
    await dialog.getByRole("button", { name: "Delete for good" }).click();
    await expect(page.getByTestId("employee-list").getByText("Delete Person", { exact: true })).toBeHidden();
    expect((await admin().from("employees").select("id").eq("id", employee2)).data).toEqual([]);
  });

  test("signed-out and wrong-role export requests are refused", async ({ browser, page }) => {
    const ctx = await browser.newContext();
    expect((await ctx.request.get(`/en/app/members/data/employees/${employee}`)).status()).toBe(401);
    expect((await ctx.request.get("/en/app/members/data/export")).status()).toBe(401);
    await ctx.close();
    await signInViaUi(page, accountant, "en");
    expect((await page.request.get("/en/app/members/data/export")).status()).toBe(403);
    expect((await page.request.get(`/en/app/members/data/employees/${employee}`)).status()).toBe(200);
  });

  test("invite page: malformed links are rejected; signed-out visitors are asked to sign in", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en/invite/not-a-token");
    await expect(page.getByText("This invitation link is not valid. Ask for a new one.")).toBeVisible();
    await page.goto(`/hy/invite/${"0".repeat(64)}`);
    await expect(page.getByText("Մուտք գործեք այն էլ․ հասցեով, որին ուղարկվել է հրավերը։")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    expect(await a11yIssues(page)).toEqual([]);
    await shoot(page, "invite-signed-out");
    expect(errors).toEqual([]);
  });

  test.describe("invitations (needs the members migration)", () => {
    let invitee: TestUser, stranger: TestUser;

    test.beforeAll(async () => {
      test.skip(!(await invitationsMigrated()), "migration 20261119020000_members.sql is not applied to this database yet");
      [invitee, stranger] = await Promise.all([createTestUser("eng-inv"), createTestUser("eng-str")]);
    });
    test.afterAll(async () => deleteTestUsers([invitee, stranger].filter(Boolean).map((u) => u.id)));

    test("owner invites, invitee signs in on the link and joins; link is single-use", async ({ page, browser }) => {
      await signInViaUi(page, owner, "en");
      await page.goto("/en/app/members");
      await page.getByLabel("Email").fill(invitee.email.toUpperCase());
      await page.getByLabel("Role", { exact: true }).selectOption("accountant");
      await page.getByRole("button", { name: "Invite", exact: true }).click();
      const link = await page.getByTestId("invite-link").first().inputValue();
      expect(link).toMatch(/\/en\/invite\/[0-9a-f]{64}$/);
      await expect(page.getByTestId("pending-list").getByText(invitee.email, { exact: true })).toBeVisible();
      await shoot(page, "members-invited");
      const path = new URL(link).pathname;

      // A stranger holding the link cannot use it.
      const sctx = await browser.newContext();
      const sp = await sctx.newPage();
      await signInViaUi(sp, stranger, "en");
      await sp.goto(path);
      await expect(sp.getByText(`This invitation is for ${invitee.email}`)).toBeVisible();
      await expect(sp.getByRole("button", { name: "Accept and open" })).toHaveCount(0);
      await sctx.close();

      // The invitee opens the link signed out and signs in right there.
      const ictx = await browser.newContext();
      const ip = await ictx.newPage();
      await ip.route("**/auth/v1/otp**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
      await ip.goto(path);
      await expect(ip.getByText("Sign in with the email address the invitation was sent to.")).toBeVisible();
      await ip.locator("#email").fill(invitee.email);
      await ip.getByRole("button", { name: "Email me a sign-in code" }).click();
      await ip.locator("#code").fill(await emailOtp(invitee.email));
      await ip.getByRole("button", { name: "Sign in" }).click();
      await expect(ip.getByText("You are invited to QA Eng Firm as Accountant.")).toBeVisible();
      expect(await a11yIssues(ip)).toEqual([]);
      await shoot(ip, "invite-accept");
      await ip.getByRole("button", { name: "Accept and open" }).click();
      await ip.waitForURL("**/en/app");
      const { data: m } = await admin().from("memberships").select("role").eq("org_id", org).eq("user_id", invitee.id).single();
      expect(m?.role).toBe("accountant");
      await ip.goto(path);
      await expect(ip.getByText("This invitation has already been used.")).toBeVisible();
      await ictx.close();

      await page.reload();
      await expect(page.getByTestId("member-list").getByText(invitee.email, { exact: true })).toBeVisible();
      await expect(page.getByText("No pending invitations.")).toBeVisible();
    });

    test("owner revokes an invitation; viewer and other firms cannot invite or read", async ({ page }) => {
      await signInViaUi(page, owner, "en");
      await page.goto("/en/app/members");
      await page.getByLabel("Email").fill(stranger.email);
      await page.getByRole("button", { name: "Invite", exact: true }).click();
      await expect(page.getByTestId("pending-list").getByText(stranger.email, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: `Revoke invitation for ${stranger.email}` }).click();
      await page.getByRole("dialog", { name: "Revoke invitation?" }).getByRole("button", { name: "Revoke" }).click();
      await expect(page.getByText("No pending invitations.")).toBeVisible();

      const asViewer = await clientAs(viewer);
      expect((await asViewer.from("invitations").insert({ org_id: org, email: "x@example.com", role: "owner" })).error).not.toBeNull();
      expect((await asViewer.from("invitations").select("*")).data ?? []).toEqual([]);
      expect((await asOutsider.from("invitations").insert({ org_id: org, email: outsider.email, role: "owner" })).error).not.toBeNull();
      expect((await asOutsider.from("invitations").select("*")).data ?? []).toEqual([]);
    });

    test("the last owner cannot be demoted or removed", async () => {
      const up = await asOwner.from("memberships").update({ role: "viewer" }).eq("org_id", org).eq("user_id", owner.id);
      expect(up.error?.message).toContain("at least one owner");
      const del = await asOwner.from("memberships").delete().eq("org_id", org).eq("user_id", owner.id);
      expect(del.error?.message).toContain("at least one owner");
    });
  });
});
