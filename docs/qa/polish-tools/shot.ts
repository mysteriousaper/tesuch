// usage: tsx shot.ts kind(app|public) mode locale width route name [full]
import { chromium } from "playwright";
const [kind, mode, loc, w, route, name, full] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: "http://localhost:3304", ...(kind === "app" ? { storageState: "/tmp/claude-0/s/state.json" } : {}), viewport: { width: +w, height: 800 }, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
  await ctx.addCookies([{ name: "tesuch-mode", value: mode, url: "http://localhost:3304" }]);
  const p = await ctx.newPage();
  await p.goto(`/${loc}${route}`, { waitUntil: "networkidle" });
  await p.screenshot({ path: `docs/qa/shots/polish/${name}.png`, fullPage: full !== "0" });
  if (process.env.HTML) console.log(await p.evaluate((s) => Array.from(document.querySelectorAll(s)).map((e) => e.outerHTML.slice(0, 300)).join("\n---\n"), process.env.HTML));
  await b.close();
})();
