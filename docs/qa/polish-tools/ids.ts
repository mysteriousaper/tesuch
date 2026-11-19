import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: "http://localhost:3304", storageState: "/tmp/claude-0/s/state.json", proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
  const p = await ctx.newPage();
  await p.goto("/en/app");
  const href = await p.evaluate(() => (document.querySelector("a[href*='/app/companies/']") as HTMLAnchorElement).getAttribute("href")!);
  await p.goto(href);
  const e = await p.evaluate(() => (document.querySelector("a[href*='/employees/']") as HTMLAnchorElement | null)?.getAttribute("href") ?? "");
  console.log(JSON.stringify({ c: href.split("/").pop(), e: e.split("/").pop() }));
  await b.close();
})();
