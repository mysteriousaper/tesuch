import { session, shot, text } from "./lib";
import fs from "node:fs";
(async () => {
  const { browser, ctx, page, errs } = await session("hy");
  try {
    const C="cb6f5570-118e-430e-b4c9-227160491f9a";
    await page.goto("/hy/app/documents?company="+C); await page.waitForTimeout(2000);
    console.log((await text(page,3000)).split("\n").slice(12,60).join(" | "));
    await shot(page,"14-documents-company-hy");
    const hrefs = await page.locator("main a[href*='/api/pdf/']").evaluateAll(a=>a.map(x=>(x as HTMLAnchorElement).getAttribute("href")!));
    console.log("links", hrefs.length, hrefs.slice(0,8));
    const types = new Set<string>(); const pick:string[]=[];
    for (const h of hrefs){ const t=h.split("/api/pdf/")[1].split("?")[0]; if(!types.has(t)){types.add(t);pick.push(h);} }
    let i=0;
    for (const h of pick){ const r=await ctx.request.get(h); const b=await r.body(); const n=`/tmp/claude-0/qa/doc-${h.split("/api/pdf/")[1].split("?")[0]}.pdf`; fs.writeFileSync(n,b); console.log(h.slice(0,60), r.status(), r.headers()["content-type"], r.headers()["content-disposition"], b.length); }
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
