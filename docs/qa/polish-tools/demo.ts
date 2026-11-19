import { chromium } from "playwright";
import { createTestUser, deleteTestUsers } from "../../../tests/e2e/helpers/supabase";
import { signInViaUi } from "../../../tests/e2e/helpers/auth";
(async () => {
  const user = await createTestUser("polish2");
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: "http://localhost:3304", viewport: { width: 1280, height: 800 }, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
  const p = await ctx.newPage();
  try {
    await signInViaUi(p, user, "en");
    await p.getByLabel("Firm name").fill("Demo timing");
    await p.getByRole("button", { name: "Create" }).click();
    await p.getByRole("button", { name: /load demo data/i }).waitFor();
    const t0 = Date.now();
    await p.getByRole("button", { name: /load demo data/i }).click();
    for (const ms of [500, 3000, 6000, 10000, 15000, 25000]) {
      await p.waitForTimeout(ms - (Date.now() - t0));
      const s = await p.evaluate(() => ({ btn: Array.from(document.querySelectorAll("button")).filter((b) => /demo|load|Load/i.test(b.innerText)).map((b) => b.innerText + (b.disabled ? " [disabled]" : "") + (b.getAttribute("aria-busy") ? " busy=" + b.getAttribute("aria-busy") : "")), companies: document.querySelectorAll("a[href*='/app/companies/']").length, text: document.body.innerText.match(/\d+ employees[^\n]*/)?.[0] }));
      console.log(Date.now() - t0, JSON.stringify(s));
      if (ms === 3000) await p.screenshot({ path: "docs/qa/shots/polish/demo-loading-3s.png" });
      if (ms === 10000) await p.screenshot({ path: "docs/qa/shots/polish/demo-loading-10s.png" });
    }
  } finally { await b.close(); await deleteTestUsers([user.id]); }
})();
