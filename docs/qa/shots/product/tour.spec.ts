import { test } from "@playwright/test";
import { createTestUser, admin } from "../../../../tests/e2e/helpers/supabase";
import { signInViaUi } from "../../../../tests/e2e/helpers/auth";
test("product tour", async ({ page }) => {
  test.setTimeout(240000);
  const u = await createTestUser("prod");
  try {
    await signInViaUi(page, u, "en");
    const shot = (n: string) => page.screenshot({ path: `docs/qa/shots/product/${n}.png`, fullPage: true });
    await shot("01-onboarding");
    const inp = page.getByLabel("Firm name");
    await inp.fill("Pilot Accounting LLC"); await page.getByRole("button", { name: "Create" }).click();
    await page.waitForTimeout(2500); await shot("02-empty");
    await page.getByRole("button", { name: /load demo/i }).click();
    await page.waitForSelector("a[href*=\"/app/companies/\"]", { timeout: 90000 }).catch(() => {}); await shot("03-dashboard");
    const links = await page.locator("a[href*='/app/companies/']").evaluateAll(as => as.map(a => (a as HTMLAnchorElement).href));
    console.log("links", links.slice(0,3));
    if (links[0]) { await page.goto(links[0]); await page.waitForTimeout(1500); await shot("04-company");
      const e = await page.locator("a[href*='/employees/']").first().getAttribute("href");
      if (e) { await page.goto(e); await page.waitForTimeout(1500); await shot("05-employee"); } }
    for (const p of ["documents","import","settings","quiz","members","audit"]) { await page.goto(`/en/app/${p}`); await page.waitForTimeout(1200); await shot(`06-${p}`); }
  } finally {
    await admin().auth.admin.deleteUser(u.id);
  }
});
