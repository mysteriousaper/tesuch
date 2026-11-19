import { session, shot, text } from "./lib";
(async () => {
  const { browser, page, errs } = await session("hy");
  try {
    await page.goto("/hy/app"); await page.waitForTimeout(1000);
    await shot(page,"08-dashboard-after-import-hy");
    console.log((await text(page,1800)));
    await page.getByRole("link",{name:/Արարատ Սթիլ/}).first().click(); await page.waitForTimeout(2500);
    console.log("URL",page.url());
    const t = await text(page,9000); console.log(t.slice(0,5000));
    await shot(page,"09-company-page-hy");
    await shot(page,"09b-company-page-hy-full",true);
    console.log("height", await page.evaluate(()=>document.body.scrollHeight));
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
