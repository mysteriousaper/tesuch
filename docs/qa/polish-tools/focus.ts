import { chromium } from "playwright";
const pages: [string, string, string][] = [["public", "/hy", "landing"], ["public", "/hy/check", "check"], ["public", "/hy/login", "login"], ["app", "/hy/app", "app"], ["app", "/hy/app/companies/6d6386f0-0df9-421f-a4d1-b2be3946ffd8", "company"], ["app", "/hy/app/import", "import"], ["app", "/hy/app/settings", "settings"], ["app", "/hy/app/members", "members"], ["app", "/hy/app/quiz", "quiz"], ["app", "/hy/app/documents", "documents"]];
(async () => {
  const b = await chromium.launch();
  for (const [kind, route, name] of pages) {
    const ctx = await b.newContext({ baseURL: "http://localhost:3304", ...(kind === "app" ? { storageState: "/tmp/claude-0/s/state.json" } : {}), viewport: { width: 1280, height: 800 }, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
    const p = await ctx.newPage();
    await p.addInitScript("window.__name=(f)=>f");
    await p.goto(route, { waitUntil: "networkidle" });
    const bad: string[] = []; let count = 0; const seq: string[] = [];
    for (let i = 0; i < 70; i++) {
      await p.keyboard.press("Tab");
      const r = await p.evaluate(() => {
        const e = document.activeElement as HTMLElement; if (!e || e === document.body) return null;
        const s = getComputedStyle(e); const rect = e.getBoundingClientRect();
        const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
        const shadow = s.boxShadow !== "none";
        const label = (e.getAttribute("aria-label") || e.innerText || e.getAttribute("placeholder") || e.id || "").trim().slice(0, 28);
        return { tag: e.tagName.toLowerCase(), label, outline, shadow, offscreen: rect.bottom < 0 || rect.top > innerHeight, y: Math.round(rect.top), tabindex: e.getAttribute("tabindex"), out: s.outlineColor + " " + s.outlineWidth + " " + s.outlineOffset };
      });
      if (!r) break;
      count++; seq.push(r.tag + ":" + r.label);
      if (!r.outline && !r.shadow) bad.push(r.tag + ":" + r.label);
      if (i === 0) await p.screenshot({ path: `/tmp/claude-0/s/focus-${name}-1.png` });
    }
    console.log(name, "tabs", count, "noFocusRing", bad.slice(0, 6), "| first5", seq.slice(0, 5).join(" > "));
    await ctx.close();
  }
  await b.close();
})();
