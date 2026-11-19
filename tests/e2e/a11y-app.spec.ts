import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/a11y";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { admin, clientAs, createTestUser, deleteTestUsers, type TestUser } from "./helpers/supabase";

// axe (WCAG 2a/2aa/21a/21aa) on the signed-in app pages. One test per page so a failure names the page.
test.describe("app accessibility (axe)", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");
  test.describe.configure({ mode: "serial" });

  let user: TestUser;
  let orgId: string;
  let companyId: string;
  // The dashboard and company pages call public.company_stats; skip them until that migration is on the real DB.
  let statsMissing = false;

  test.beforeAll(async () => {
    user = await createTestUser("axe");
    const asUser = await clientAs(user);
    const { data: org, error } = await asUser.rpc("create_org", { p_name: "QA Axe Firm" });
    expect(error).toBeNull();
    orgId = org as string;
    const co = await asUser.from("companies").insert({ org_id: org, name: "QA Axe Co" }).select("id").single();
    expect(co.error).toBeNull();
    companyId = co.data!.id;
    const probe = await admin().rpc("company_stats", { p_company: companyId, p_org: orgId, p_today: "2026-01-01" });
    statsMissing = /company_stats/.test(probe.error?.message ?? "") && /schema cache|does not exist/.test(probe.error?.message ?? "");
  });
  test.afterAll(async () => deleteTestUsers([user?.id].filter(Boolean)));

  const PAGES: { name: string; path: () => string; needsStats?: boolean }[] = [
    { name: "dashboard", path: () => "/hy/app", needsStats: true },
    { name: "company", path: () => `/hy/app/companies/${companyId}`, needsStats: true },
    { name: "import", path: () => "/hy/app/import" },
    { name: "members", path: () => "/hy/app/members" },
    { name: "documents", path: () => "/hy/app/documents" },
    { name: "audit", path: () => "/hy/app/audit" },
    { name: "quiz", path: () => "/hy/app/quiz" },
    { name: "settings", path: () => "/hy/app/settings" },
  ];

  for (const p of PAGES) {
    test(`${p.name} has no axe WCAG A/AA violations`, async ({ page }, testInfo) => {
      test.skip(Boolean(p.needsStats) && statsMissing, "public.company_stats missing on the real DB (migration 20261120010000 not applied)");
      await signInViaUi(page, user, "hy");
      const res = await page.goto(p.path());
      expect(res?.status(), p.path()).toBeLessThan(400);
      await page.waitForLoadState("networkidle");
      await expectNoAxeViolations(page, testInfo);
    });
  }
});
