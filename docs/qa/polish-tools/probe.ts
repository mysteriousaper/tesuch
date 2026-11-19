import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: "http://localhost:3304", storageState: "/tmp/claude-0/s/state.json", viewport: { width: 1280, height: 900 }, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
  const p = await ctx.newPage();
  await p.goto("/en/app");
  await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href")).filter((h) => /companies/.test(h || ""))));
  await p.screenshot({ path: "/tmp/claude-0/s/app1.png" });
  await b.close();
})();
