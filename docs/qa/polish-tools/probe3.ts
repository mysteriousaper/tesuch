import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: "http://localhost:3304", viewport: { width: 1280, height: 800 }, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
  const p = await ctx.newPage();
  await p.addInitScript("window.__name=(f)=>f");
  for (const [loc, w] of [["hy", 1280], ["hy", 360], ["ru", 360]] as const) {
    await p.setViewportSize({ width: w, height: 800 });
    await p.goto(`/${loc}`, { waitUntil: "networkidle" });
    const idx = await p.evaluate(() => { const e = Array.from(document.querySelectorAll("span.min-w-0.flex-1")).find((x) => (x as HTMLElement).scrollWidth > (x as HTMLElement).clientWidth + 1) as HTMLElement; e.scrollIntoView({ block: "center" }); return e.outerHTML.slice(0, 250) + " | parent: " + e.parentElement!.className; });
    console.log(loc, w, idx);
    await p.screenshot({ path: `docs/qa/shots/polish/landing-trunc-${loc}-${w}.png` });
  }
  await b.close();
})();
