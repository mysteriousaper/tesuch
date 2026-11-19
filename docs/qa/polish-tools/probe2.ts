import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: "http://localhost:3304", storageState: "/tmp/claude-0/s/state.json", viewport: { width: 390, height: 800 }, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
  const p = await ctx.newPage();
  await p.addInitScript("window.__name=(f)=>f");
  for (const r of ["/hy/app/settings", "/hy/app/companies/6d6386f0-0df9-421f-a4d1-b2be3946ffd8"]) {
    await p.goto(r, { waitUntil: "networkidle" });
    console.log(r, await p.evaluate(() => Array.from(document.querySelectorAll("button")).filter((e) => !(e.getAttribute("aria-label") || e.innerText || "").trim()).map((e) => e.outerHTML.slice(0, 400))));
    console.log(await p.evaluate(() => { const h = document.querySelector("header") || document.body.firstElementChild!; const r = h.getBoundingClientRect(); return { hdr: [r.left, r.right, (h as HTMLElement).scrollWidth], kids: Array.from(h.querySelectorAll("a,button,div")).slice(0,0) }; }));
  }
  await p.goto("/hy/app", { waitUntil: "networkidle" });
  await p.screenshot({ path: "docs/qa/shots/polish/app-header-hy-390.png", clip: { x: 0, y: 0, width: 390, height: 260 } });
  console.log(await p.evaluate(() => Array.from(document.querySelectorAll("header *, nav *")).filter((e) => (e as HTMLElement).getBoundingClientRect().right > 390).slice(0, 8).map((e) => e.tagName + " " + (e as HTMLElement).innerText?.slice(0, 20) + " r=" + Math.round((e as HTMLElement).getBoundingClientRect().right))));
  await b.close();
})();
