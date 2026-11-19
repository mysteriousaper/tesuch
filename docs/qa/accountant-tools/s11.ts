import { session, shot, text } from "./lib";
import fs from "node:fs";
(async () => {
  const { browser, ctx, page, errs } = await session("hy");
  try {
    const C="cb6f5570-118e-430e-b4c9-227160491f9a", E="0207454f-c91b-448f-b0c6-a534a3ea4008";
    await page.goto(`/hy/app/companies/${C}/employees/${E}`); await page.waitForTimeout(1500);
    const f = page.locator("main form").first();
    await f.locator("details summary").click();
    await f.locator('input[name=terminated_on]').fill("2026-11-18");
    await f.locator('input[name=notice_given_on]').fill("2026-11-10");
    await f.locator('select[name=termination_initiator]').selectOption({index:1});
    await f.locator('input[name=termination_ground]').fill("Կրճատում");
    await f.locator('input[name=workforce_reduction]').check();
    await shot(page,"18-termination-form-hy");
    await f.locator("button[type=submit]").click(); await page.waitForTimeout(3000);
    console.log("st:", await f.locator("[role=status]").innerText());
    await page.goto(`/hy/app/documents?company=${C}`); await page.waitForTimeout(2000);
    const hrefs = await page.locator("main a[href*='/api/pdf/dismissal']").evaluateAll(a=>a.map(x=>(x as HTMLAnchorElement).getAttribute("href")!));
    console.log(hrefs);
    if (hrefs[0]) { const r=await ctx.request.get(hrefs[0]); fs.writeFileSync("/tmp/claude-0/qa/doc-dismissal.pdf", await r.body()); console.log(r.status(), r.headers()["content-disposition"]); }
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
