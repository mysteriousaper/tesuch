import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: "http://localhost:3304", storageState: "/tmp/claude-0/s/state.json", proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
  const p = await ctx.newPage();
  let n = 0; const where: string[] = [];
  p.on("pageerror", (e) => { if (/418|Hydration/.test(e.message)) { n++; where.push(p.url()); } });
  const routes = ["/en/app", "/ru/app/companies/6d6386f0-0df9-421f-a4d1-b2be3946ffd8", "/en/app/members/data", "/hy/app/audit", "/ru/app/quiz", "/hy/app/documents"];
  for (let i = 0; i < 6; i++) for (const r of routes) { await p.goto(r, { waitUntil: "networkidle" }); }
  console.log("hydration errors", n, where);
  await b.close();
})();
