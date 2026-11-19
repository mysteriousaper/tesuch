import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: "http://localhost:3304", storageState: "/tmp/claude-0/s/state.json", viewport: { width: 1280, height: 900 }, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
  const p = await ctx.newPage();
  await p.goto("/hy/app/documents", { waitUntil: "networkidle" });
  console.log(await p.evaluate(() => Array.from(document.querySelectorAll("input")).slice(0, 3).map((e) => e.outerHTML.slice(0, 260) + " || " + (e.parentElement?.outerHTML.slice(0, 200)))));
  for (let i = 0; i < 12; i++) await p.keyboard.press("Tab");
  await p.screenshot({ path: "docs/qa/shots/polish/documents-hy-focus.png" });
  await b.close();
})();
