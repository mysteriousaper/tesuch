import { chromium } from "playwright";
const C = "6d6386f0-0df9-421f-a4d1-b2be3946ffd8";
const routes: [string, string][] = [["public", ""], ["public", "/check"], ["public", "/login"], ["public", "/themes"], ["public", "/terms"], ["app", "/app"], ["app", "/app/quiz"], ["app", "/app/import"], ["app", "/app/documents"], ["app", "/app/members"], ["app", "/app/audit"], ["app", "/app/settings"], ["app", `/app/companies/${C}`]];
const scan = () => {
  const parse = (s: string) => { const m = s.match(/[\d.]+/g)!.map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
  const lum = (c: { r: number; g: number; b: number }) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const out: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set<Element>();
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (!n.textContent?.trim()) continue;
    const el = n.parentElement!; if (seen.has(el)) continue; seen.add(el);
    const r = el.getBoundingClientRect(); const st = getComputedStyle(el);
    if (r.width === 0 || st.visibility === "hidden" || el.closest("[aria-hidden=true],.sr-only,option")) continue;
    let op = 1; let bg = { r: 255, g: 255, b: 255 }; let found = false;
    for (let e: Element | null = el; e; e = e.parentElement) { op *= parseFloat(getComputedStyle(e).opacity); }
    const stack: Element[] = []; for (let e: Element | null = el; e; e = e.parentElement) stack.push(e);
    // composite backgrounds from root down
    let cur = { r: 255, g: 255, b: 255 };
    for (const e of stack.reverse()) { const b = parse(getComputedStyle(e).backgroundColor); if (b.a > 0) { cur = { r: cur.r * (1 - b.a) + b.r * b.a, g: cur.g * (1 - b.a) + b.g * b.a, b: cur.b * (1 - b.a) + b.b * b.a }; found = true; } }
    bg = cur;
    const fg = parse(st.color); const a = fg.a * op;
    const eff = { r: bg.r * (1 - a) + fg.r * a, g: bg.g * (1 - a) + fg.g * a, b: bg.b * (1 - a) + fg.b * a };
    const [l1, l2] = [lum(eff), lum(bg)].sort((x, y) => y - x);
    const ratio = (l1 + 0.05) / (l2 + 0.05);
    const size = parseFloat(st.fontSize); const bold = parseInt(st.fontWeight) >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < need) out.push(`${ratio.toFixed(2)} (<${need}) "${n.textContent!.trim().slice(0, 40)}" ${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} op=${op.toFixed(2)} ${size}px`);
  }
  return out;
};
(async () => {
  const b = await chromium.launch();
  for (const [kind, route] of routes) {
    for (const mode of ["light", "dark"]) {
      const ctx = await b.newContext({ baseURL: "http://localhost:3304", ...(kind === "app" ? { storageState: "/tmp/claude-0/s/state.json" } : {}), viewport: { width: 1280, height: 800 }, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
      await ctx.addCookies([{ name: "tesuch-mode", value: mode, url: "http://localhost:3304" }]);
      await ctx.addInitScript("window.__name=(f)=>f");
      const p = await ctx.newPage();
      await p.goto(`/en${route}`, { waitUntil: "networkidle" });
      const r = await p.evaluate(scan);
      console.log(`## ${route || "/"} ${mode}: ${r.length}`); r.slice(0, 8).forEach((x) => console.log("  ", x));
      await ctx.close();
    }
  }
  await b.close();
})();
