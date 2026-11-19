import { chromium } from "playwright";
import { createTestUser, deleteTestUsers, emailOtp } from "../../../tests/e2e/helpers/supabase";
const out = "/home/user/tesuch/docs/qa/shots/owner/";
const base = "http://localhost:3302";
(async () => {
  const user = await createTestUser("owner", { consent: false });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs: string[] = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  try {
    await p.route("**/auth/v1/otp**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await p.goto(`${base}/hy/login`);
    await p.screenshot({ path: out + "08-login-390.png" });
    await p.locator("#email").fill(user.email);
    await p.locator('form button[type="submit"]').click();
    await p.locator("#code").waitFor();
    await p.screenshot({ path: out + "09-login-code-390.png" });
    await p.locator("#code").fill(await emailOtp(user.email));
    await p.locator('form button[type="submit"]').click();
    await p.waitForURL("**/consent**");
    await p.screenshot({ path: out + "10-consent-390.png", fullPage: true });
    console.log("CONSENT:\n" + (await p.innerText("main")).slice(0, 1500));
    console.log("checkboxes", await p.locator("input[type=checkbox]").count());
    const sub = p.locator('form button[type="submit"]');
    console.log("submit disabled before?", await sub.isDisabled());
    for (const c of await p.locator("input[type=checkbox]").all()) await c.check();
    await sub.click();
    await p.waitForURL(/\/hy\/app/,{timeout:20000}).catch(()=>{});
    console.log("URL after consent", p.url());
    await p.screenshot({ path: out + "11-after-consent-390.png", fullPage: true });
    console.log("APP:\n" + (await p.innerText("body")).slice(0, 1500));
  } catch (e) { console.log("ERR", String(e).slice(0, 500)); await p.screenshot({ path: out + "99-err.png" }); }
  console.log("console errors", errs);
  console.log("USER", user.email);
  await b.close();
  await deleteTestUsers([user.id]);
})();
