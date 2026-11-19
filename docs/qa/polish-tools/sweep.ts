// Sweep: routes x locales x viewports x modes. Collects automated a11y/layout signals into JSON.
import { chromium, type Page } from "playwright";
import { writeFileSync } from "node:fs";

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined;
const VPS = [360, 390, 768, 1280, 1440];
const LOCALES = ["hy", "ru", "en"];
const ids = JSON.parse(process.env.IDS ?? "{}") as { c: string; e: string };
const PUBLIC = ["", "/check", "/login", "/terms", "/terms/dpa", "/privacy", "/themes", "/nope-404", "/invite/bad-token"];
const APP = ["/app", "/app/import", "/app/documents", "/app/quiz", "/app/members", "/app/members/data", "/app/audit", "/app/settings", `/app/companies/${ids.c}`, `/app/companies/${ids.c}/employees/${ids.e}`];

const probe = () => {
  const out: Record<string, unknown> = {};
  const de = document.documentElement;
  out.hOverflow = de.scrollWidth - de.clientWidth;
  out.lang = de.lang; out.title = document.title;
  out.h1 = document.querySelectorAll("h1").length;
  const vw = de.clientWidth;
  const label = (e: Element) => (e.getAttribute("aria-label") || (e as HTMLElement).innerText || e.getAttribute("title") || "").trim();
  const sel = (e: Element) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" ? "." + e.className.split(" ").slice(0, 2).join(".") : "");
  const vis = (e: Element) => { const r = (e as HTMLElement).getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  out.offscreen = Array.from(document.querySelectorAll("body *")).filter((e) => vis(e) && (e as HTMLElement).getBoundingClientRect().right > vw + 1 && !e.closest("[class*=overflow-x-auto],[class*=overflow-auto]")).slice(0, 5).map(sel);
  out.clipped = Array.from(document.querySelectorAll("body *")).filter((e) => { const s = getComputedStyle(e); const h = e as HTMLElement; return vis(e) && h.scrollWidth > h.clientWidth + 1 && (s.overflowX === "hidden" || s.textOverflow === "ellipsis") && h.innerText?.trim(); }).slice(0, 5).map((e) => sel(e) + ":" + (e as HTMLElement).innerText.slice(0, 30));
  out.unlabelledBtn = Array.from(document.querySelectorAll("button,a[href],[role=button]")).filter((e) => vis(e) && !label(e) && !e.querySelector("img[alt]:not([alt=''])")).slice(0, 5).map(sel);
  out.unlabelledField = Array.from(document.querySelectorAll("input:not([type=hidden]),select,textarea")).filter((e) => { const i = e as HTMLInputElement; return vis(e) && !(i.labels && i.labels.length) && !e.getAttribute("aria-label") && !e.getAttribute("aria-labelledby"); }).slice(0, 5).map(sel);
  out.imgNoAlt = Array.from(document.querySelectorAll("img:not([alt])")).length;
  out.small = Array.from(document.querySelectorAll("button,a[href],input:not([type=hidden]),select,[role=tab]")).filter((e) => { if (!vis(e)) return false; const r = (e as HTMLElement).getBoundingClientRect(); const inline = getComputedStyle(e).display === "inline" && e.tagName === "A"; return !inline && (r.width < 24 || r.height < 24); }).slice(0, 6).map((e) => sel(e) + " " + Math.round((e as HTMLElement).getBoundingClientRect().width) + "x" + Math.round((e as HTMLElement).getBoundingClientRect().height));
  out.hdgSkip = (() => { const hs = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => +h.tagName[1]); let bad = 0; for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) bad++; return bad; })();
  out.dupId = (() => { const m: Record<string, number> = {}; document.querySelectorAll("[id]").forEach((e) => (m[e.id] = (m[e.id] || 0) + 1)); return Object.keys(m).filter((k) => m[k] > 1); })();
  out.landmarks = { main: document.querySelectorAll("main,[role=main]").length, nav: document.querySelectorAll("nav").length };
  out.latinInHy = de.lang === "hy" ? Array.from(document.body.innerText.matchAll(/[A-Za-z]{4,}/g)).map((m) => m[0]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 12) : [];
  out.asciiEnd = de.lang === "hy" ? Array.from(document.body.innerText.split("\n")).filter((l) => /[Ա-֏]{3,}[.:]\s*$/.test(l.trim())).slice(0, 4) : [];
  return out;
};

async function run() {
  const browser = await chromium.launch();
  const results: unknown[] = [];
  for (const kind of ["public", "app"] as const) {
    const ctx = await browser.newContext({ baseURL: "http://localhost:3304", proxy, ignoreHTTPSErrors: true, ...(kind === "app" ? { storageState: "/tmp/claude-0/s/state.json" } : {}) });
    await ctx.addInitScript("window.__name=(f)=>f");
    for (const mode of ["light", "dark"]) {
      await ctx.addCookies([{ name: "tesuch-mode", value: mode, url: "http://localhost:3304" }]);
      const page: Page = await ctx.newPage();
      const errs: string[] = [];
      page.on("console", (m) => { if (["error", "warning"].includes(m.type())) errs.push(m.type() + ": " + m.text().slice(0, 160)); });
      page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 160)));
      page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/_next/image")) errs.push(`http ${r.status()} ${r.url().replace("http://localhost:3304", "").slice(0, 80)}`); });
      for (const loc of LOCALES) for (const route of kind === "public" ? PUBLIC : APP) for (const w of VPS) {
        errs.length = 0;
        await page.setViewportSize({ width: w, height: 800 });
        let status = 0;
        try { const r = await page.goto(`/${loc}${route}`, { waitUntil: "networkidle", timeout: 30000 }); status = r?.status() ?? 0; } catch (e) { results.push({ kind, mode, loc, route, w, nav: String(e).slice(0, 100) }); continue; }
        const p = await page.evaluate(probe);
        results.push({ kind, mode, loc, route: route.replace(/[0-9a-f-]{36}/g, ":id"), w, status, url: page.url().replace("http://localhost:3304", ""), errs: [...errs], ...p });
      }
      await page.close();
    }
    await ctx.close();
  }
  writeFileSync("/tmp/claude-0/s/sweep.json", JSON.stringify(results));
  console.log("done", results.length);
  await browser.close();
}
run();
