// Creates a throwaway user, signs in through the real UI (OTP send stubbed), loads demo data, saves state.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { createTestUser } from "../../../tests/e2e/helpers/supabase";
import { signInViaUi } from "../../../tests/e2e/helpers/auth";
import { loadEnv } from "../../../tests/e2e/helpers/env";

loadEnv();
const base = "http://localhost:3304";
(async () => {
  const user = await createTestUser("polish");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: base, ignoreHTTPSErrors: true, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
  const page = await ctx.newPage();
  await signInViaUi(page, user, "en");
  await page.screenshot({ path: "/tmp/claude-0/s/empty-app.png" });
  await page.getByLabel("Firm name").fill("Polish QA Firm");
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: /load demo data/i }).click();
  await page.waitForTimeout(8000);
  const links = await page.$$eval("a[href*='/app/companies/']", (as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")));
  console.log("companies", links.slice(0, 6));
  await ctx.storageState({ path: "/tmp/claude-0/s/state.json" });
  writeFileSync("/tmp/claude-0/s/user.json", JSON.stringify(user));
  await browser.close();
})();
