import { expect, test } from "@playwright/test";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { a11yIssues, expectNoHorizontalScroll, trackErrors } from "./helpers/page-checks";
import { admin, anon, clientAs, createTestUser, deleteTestUsers, type TestUser } from "./helpers/supabase";

const LOCALES = ["hy", "ru", "en"] as const;
const PATHS = ["/privacy", "/terms", "/terms/dpa"] as const;
const BANNER = { hy: "Նախագիծ՝ իրավաբանի ստուգման փուլում", ru: "Черновик — на проверке у юриста", en: "Draft — under lawyer review" };

test.describe("legal pages", () => {
  for (const locale of LOCALES) {
    for (const path of PATHS) {
      test(`/${locale}${path} renders the draft with banner, noindex and no a11y issues`, async ({ page }) => {
        const errors = trackErrors(page);
        const res = await page.goto(`/${locale}${path}`);
        expect(res?.status(), "HTTP status").toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("h1")).toBeVisible();
        await expect(page.getByTestId("legal-draft-banner")).toContainText(BANNER[locale]);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
        await page.waitForLoadState("networkidle");
        await expectNoHorizontalScroll(page);
        expect(await a11yIssues(page)).toEqual([]);
        expect(errors, "console errors").toEqual([]);
      });
    }
  }

  test("privacy notice lists the data, EU hosting, processors and rights", async ({ page }) => {
    await page.goto("/en/privacy");
    const main = page.locator("main");
    for (const text of ["date of birth", "Ireland", "Supabase", "Vercel", "Resend", "Telegram", "Access", "Correction", "Deletion", "Export"]) {
      await expect(main).toContainText(text);
    }
    // The table of contents links to every section.
    const toc = page.getByRole("navigation", { name: "Contents" }).getByRole("link");
    expect(await toc.count()).toBeGreaterThanOrEqual(10);
    await toc.first().click();
    await expect(page).toHaveURL(/#who$/);
  });

  test("DPA shows English and Armenian side by side at desktop width and stays printable", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/ru/terms/dpa");
    const first = page.locator("ol li").first();
    const en = first.locator('[lang="en"]');
    const hy = first.locator('[lang="hy"]');
    await expect(en).toContainText("Subject");
    await expect(hy).toContainText("Առարկա");
    const [a, b] = [await en.boundingBox(), await hy.boundingBox()];
    expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1);
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(4);
    await expect(page.locator("ol li")).toHaveCount(12);
    await expect(page.getByRole("button", { name: "Распечатать или сохранить PDF" })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Распечатать или сохранить PDF" })).toBeHidden();
    await expect(page.getByTestId("legal-draft-banner")).toBeVisible();
  });

  test("screenshots at 390 and 1280", async ({ page }, info) => {
    test.skip(!process.env.LEGAL_SHOTS, "set LEGAL_SHOTS=1 to capture screenshots");
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [locale, path] of [["hy", "/privacy"], ["ru", "/terms"], ["en", "/terms/dpa"], ["hy", "/terms/dpa"]] as const) {
        await page.goto(`/${locale}${path}`);
        await page.screenshot({ path: info.outputPath(`${locale}${path.replaceAll("/", "-")}-${width}.png`), fullPage: false });
      }
    }
  });

  test("consent page sends signed-out visitors to sign in", async ({ page }) => {
    test.skip(!hasSupabase(), "Supabase keys not configured");
    await page.goto("/hy/consent");
    await expect(page).toHaveURL(/\/hy\/login$/);
  });
});

test.describe("consent gate", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");
  test.describe.configure({ mode: "serial" });

  let user: TestUser;
  let tableExists = false;

  test.beforeAll(async () => {
    user = await createTestUser("legal");
    const { error } = await admin().from("consent_records").select("id").limit(1);
    tableExists = !error;
  });
  test.afterAll(async () => deleteTestUsers([user?.id].filter(Boolean)));

  const rows = async () => {
    const { data, error } = await admin().from("consent_records").select("document, version, accepted_at, ip_hash").eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return data;
  };

  test("records terms + privacy consent exactly once, then lets the user through", async ({ page }) => {
    const errors = trackErrors(page);
    await signInViaUi(page, user, "en");
    await page.goto("/en/consent");

    if (!tableExists) {
      // Migration 20261119030000 not applied to this database yet: the gate fails open instead of locking users out.
      test.info().annotations.push({ type: "note", description: "consent_records missing: verified fail-open only" });
      await expect(page).toHaveURL(/\/en\/app$/);
      return;
    }

    await expect(page.getByRole("heading", { level: 1, name: "Before you continue" })).toBeVisible();
    expect(await a11yIssues(page)).toEqual([]);
    await expectNoHorizontalScroll(page);

    // Not pre-ticked: submitting without the box shows an error and records nothing.
    await page.getByRole("button", { name: "Accept and continue" }).click();
    await expect(page.getByRole("alert")).toContainText("Tick the box");
    expect(await rows()).toHaveLength(0);

    await page.getByLabel("I have read and accept").check();
    await page.getByRole("button", { name: "Accept and continue" }).click();
    await page.waitForURL("**/en/app");

    const recorded = await rows();
    expect(recorded.map((r) => r.document).sort()).toEqual(["privacy", "terms"]);
    for (const r of recorded) {
      expect(r.version).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(Date.now() - new Date(r.accepted_at).getTime()).toBeLessThan(5 * 60_000);
    }

    // Already accepted: the gate redirects straight to the app and nothing new is written.
    await page.goto("/en/consent");
    await expect(page).toHaveURL(/\/en\/app$/);
    expect(await rows()).toHaveLength(2);
    expect(errors, "console errors").toEqual([]);
  });

  test("another user cannot read this user's consent", async () => {
    test.skip(!tableExists, "consent_records not migrated in this database");
    const other = await createTestUser("legal-other");
    try {
      const c = await clientAs(other);
      const { data, error } = await c.from("consent_records").select("id").eq("user_id", user.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
      const { error: anonError, data: anonData } = await anon().from("consent_records").select("id");
      expect(anonError ?? anonData?.length === 0).toBeTruthy();
    } finally {
      await deleteTestUsers([other.id]);
    }
  });
});
