import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: "http://localhost:3304", viewport: { width: 390, height: 800 }, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
  const p = await ctx.newPage();
  await p.route("**/auth/v1/otp**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  for (const loc of ["hy", "ru", "en"]) {
    await p.goto(`/${loc}/login`, { waitUntil: "networkidle" });
    await p.locator("#email").fill("not-an-email");
    await p.keyboard.press("Enter");
    await p.waitForTimeout(800);
    console.log(loc, "invalid email ->", await p.evaluate(() => ({ msg: (document.querySelector("#email") as HTMLInputElement).validationMessage, live: Array.from(document.querySelectorAll("[role=alert],[aria-live]")).map((e) => (e as HTMLElement).innerText).join("|"), focus: document.activeElement?.id })));
    await p.locator("#email").fill("x@example.com");
    await p.keyboard.press("Enter");
    await p.waitForSelector("#code");
    console.log(loc, "focus after send:", await p.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
    await p.locator("#code").fill("000000");
    await p.keyboard.press("Enter");
    await p.waitForTimeout(2500);
    const t = await p.evaluate(() => ({ alert: Array.from(document.querySelectorAll("[role=alert],[aria-live]")).map((e) => (e as HTMLElement).innerText).join("|"), focus: document.activeElement?.id || document.activeElement?.tagName, code: { inputmode: (document.querySelector("#code") as HTMLInputElement).inputMode, ac: (document.querySelector("#code") as HTMLInputElement).autocomplete, maxlen: (document.querySelector("#code") as HTMLInputElement).maxLength } }));
    console.log(loc, "bad code ->", JSON.stringify(t));
    if (loc === "hy") await p.screenshot({ path: "docs/qa/shots/polish/login-badcode-hy-390.png" });
  }
  await b.close();
})();
