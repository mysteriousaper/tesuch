import { session, shot, text } from "./lib";
(async () => {
  const { browser, ctx, page, errs } = await session("hy");
  try {
    const C="cb6f5570-118e-430e-b4c9-227160491f9a";
    for (const p of ["/hy/app","/hy/app/companies/"+C,"/hy/app/documents?company="+C,"/hy/app/audit","/hy/app/members/data"]) {
      const t0=Date.now(); await page.goto(p,{waitUntil:"load"}); const t1=Date.now()-t0;
      const m = await page.evaluate(()=>({dom:document.getElementsByTagName("*").length,h:document.body.scrollHeight,bytes:performance.getEntriesByType("navigation").map((n:any)=>n.transferSize)[0]}));
      console.log(p.slice(0,50), t1+"ms", JSON.stringify(m));
    }
    // mobile
    const m = await ctx.browser()!.newContext({ viewport:{width:390,height:844}, baseURL:"http://localhost:3301", storageState: await ctx.storageState(), deviceScaleFactor:1 });
    const mp = await m.newPage();
    for (const [p,n] of [["/hy/app","31-mobile-dashboard-hy"],["/hy/app/companies/"+C,"32-mobile-company-hy"],["/hy/app/import","33-mobile-import-hy"]]) {
      await mp.goto(p); await mp.waitForTimeout(1200);
      const ov = await mp.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
      console.log(n, "horizontal overflow:", ov);
      await mp.screenshot({path:`docs/qa/shots/accountant/${n}.png`});
    }
  } finally { await browser.close(); }
})();
