import { chromium, type Page } from "playwright";
import { createTestUser, deleteTestUsers, type TestUser } from "../../../tests/e2e/helpers/supabase";
import { signInViaUi } from "../../../tests/e2e/helpers/auth";
export const BASE = "http://localhost:3301";
export const SHOTS = "docs/qa/shots/accountant";
export async function boot(user: TestUser, locale: "hy"|"ru"|"en" = "hy", opts: {consent?: boolean} = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type()==="error") errs.push(m.text().slice(0,200)); });
  page.on("pageerror", (e) => errs.push("PAGEERR "+e.message.slice(0,200)));
  return { browser, ctx, page, errs };
}
export { createTestUser, deleteTestUsers, signInViaUi };
import fs from "node:fs";
const UF = "/tmp/claude-0/qa/user.json";
export async function session(locale: "hy"|"ru"|"en" = "hy") {
  let u: TestUser;
  if (fs.existsSync(UF)) u = JSON.parse(fs.readFileSync(UF, "utf8"));
  else { u = await createTestUser("acc"); fs.writeFileSync(UF, JSON.stringify(u)); }
  const b = await boot(u, locale);
  await signInViaUi(b.page, u, locale);
  return { ...b, u };
}
export const shot = (page: Page, name: string, full = false) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full });
export const text = async (page: Page, max = 3000) => (await page.locator("body").innerText()).slice(0, max);
