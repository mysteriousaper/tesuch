import { expect, test } from "@playwright/test";
import { signInViaUi } from "./helpers/auth";
import { hasSupabase } from "./helpers/env";
import { trackErrors } from "./helpers/page-checks";
import { admin, clientAs, createTestUser, deleteTestUsers, type TestUser } from "./helpers/supabase";

// Armenian headers, DD.MM.YYYY dates, one invalid row. The minor on probation must produce a finding.
const CSV = [
  "Անուն Ազգանուն,Ծննդյան ամսաթիվ,Ընդունման ամսաթիվ,Փորձաշրջանի ավարտ",
  "Թեստ Աշխատող Մեկ,15.03.1990,01.09.2026,30.11.2026",
  "Թեստ Աշխատող Երկու,01.01.2010,01.10.2026,31.12.2026",
  "Թեստ Սխալ Տող,31.02.1990,01.10.2026,",
].join("\n");

test.describe("staff import (lane B)", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");
  // The re-import test depends on the first import's data (a failure would otherwise re-run beforeAll with a fresh company).
  test.describe.configure({ mode: "serial" });

  let user: TestUser;
  let companyId: string;

  test.beforeAll(async () => {
    user = await createTestUser("import");
    const asUser = await clientAs(user);
    const { data: org, error } = await asUser.rpc("create_org", { p_name: "QA Import Firm" });
    expect(error).toBeNull();
    const co = await asUser.from("companies").insert({ org_id: org, name: "QA Import Co" }).select("id").single();
    expect(co.error).toBeNull();
    companyId = co.data!.id;
  });

  test.afterAll(async () => deleteTestUsers([user?.id].filter(Boolean)));

  test("CSV with Armenian headers → map → preview errors → import → findings", async ({ page }) => {
    const errors = trackErrors(page);
    const notFound: string[] = [];
    page.on("response", (r) => {
      if (r.status() === 404) notFound.push(new URL(r.url()).pathname);
    });
    await signInViaUi(page, user, "en");
    await page.getByRole("navigation", { name: "App" }).getByRole("link", { name: "Import" }).click();
    await expect(page).toHaveURL(/\/en\/app\/import$/);
    await expect(page.getByRole("heading", { level: 1, name: "Import staff" })).toBeVisible();

    await page.getByLabel("Company").selectOption(companyId);
    await page.getByLabel("File (.csv, .xlsx)").setInputFiles({ name: "staff.csv", mimeType: "text/csv", buffer: Buffer.from(CSV, "utf8") });

    // Column mapping step: headers were recognised, so Next is enabled.
    await expect(page.getByRole("heading", { name: "Match the columns" })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    // Preview: 2 valid rows, 1 row with an impossible date is reported, not imported.
    await expect(page.getByText("2 rows ready to import")).toBeVisible();
    await expect(page.getByText("1 row with errors will be skipped")).toBeVisible();
    await page.getByRole("button", { name: "Import (2)" }).click();

    await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Imported 2 employees")).toBeVisible();
    await expect(page.getByText(/open issues? found/)).toBeVisible();
    await expect(page.getByText(/Inspection readiness: \d+\/100/)).toBeVisible();

    // Database: exactly the two valid employees, and the rule run wrote findings (minor on probation).
    const db = admin();
    const { data: emps } = await db.from("employees").select("full_name").eq("company_id", companyId).order("full_name");
    expect(emps?.map((e) => e.full_name)).toEqual(["Թեստ Աշխատող Երկու", "Թեստ Աշխատող Մեկ"]);
    const { data: findings } = await db.from("findings").select("rule_id").eq("company_id", companyId);
    expect(findings?.map((f) => f.rule_id)).toContain("probation-minor");
    // D-2 resolved: the "Open the company page" link now resolves (lane A), so no 404s at all.
    expect(notFound, "404 responses").toEqual([]);
    expect(errors, "console errors").toEqual([]);

    await page.getByRole("link", { name: "Open the company page" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "QA Import Co" })).toBeVisible();
  });

  test("re-importing the same file does not duplicate employees", async ({ page }) => {
    await signInViaUi(page, user, "en");
    await page.goto("/en/app/import");
    await page.getByLabel("Company").selectOption(companyId);
    await page.getByLabel("File (.csv, .xlsx)").setInputFiles({ name: "staff.csv", mimeType: "text/csv", buffer: Buffer.from(CSV, "utf8") });
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: /^Import \(\d+\)$/ }).click();
    await expect(page.getByRole("heading", { name: /Import complete|There are no new rows/ }).or(page.getByText(/no new rows/))).toBeVisible({ timeout: 30_000 });
    const { data } = await admin().from("employees").select("full_name, birth_date").eq("company_id", companyId).order("full_name");
    expect(data).toEqual([
      { full_name: "Թեստ Աշխատող Երկու", birth_date: "2010-01-01" },
      { full_name: "Թեստ Աշխատող Մեկ", birth_date: "1990-03-15" },
    ]);
  });

  test("title rows above the header and windows-1251 encoding are handled", async ({ page }) => {
    await signInViaUi(page, user, "en");
    await page.goto("/en/app/import");
    await page.getByLabel("Company").selectOption(companyId);
    // windows-1251 file with two title rows above the header (Cyrillic headers, so mojibake would break the mapping).
    const csv = ["Список сотрудников;;", "Итого: 1;;", "ФИО;Дата приема;Дата рождения", "Тест Кодировка;01.09.2026;15.03.1990"].join("\n");
    const buffer = new Uint8Array(Buffer.from(csv, "latin1"));
    for (let i = 0, cp = Array.from(csv); i < cp.length; i++) {
      const c = cp[i].charCodeAt(0);
      buffer[i] = c >= 0x410 && c <= 0x44f ? c - 0x410 + 0xc0 : c;
    }
    await page.getByLabel("File (.csv, .xlsx)").setInputFiles({ name: "cp1251.csv", mimeType: "text/csv", buffer: Buffer.from(buffer) });
    await expect(page.getByRole("heading", { name: "Match the columns" })).toBeVisible();
    await expect(page.getByLabel("Header row")).toHaveValue("3");
    await expect(page.getByLabel("Encoding")).toHaveValue("windows-1251");
    await expect(page.getByText("Found 1 row")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();

    // Manual override re-parses live; row 1 has no recognisable columns, so Next is blocked.
    await page.getByLabel("Header row").fill("1");
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
    await page.getByLabel("Header row").fill("3");
    await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
  });
});
