import { session, shot, text } from "./lib";
(async () => {
  const { browser, page, errs } = await session("hy");
  try {
    console.log("rows", await page.locator("main a[href*='/companies/']").count());
    console.log(await page.locator("main a[href*='/companies/']").evaluateAll(a=>a.map(x=>x.getAttribute("href")+" "+(x as HTMLElement).innerText.split("\n")[0])));
    await page.goto("/hy/app/import"); await page.waitForTimeout(800);
    console.log(await text(page,1500));
    console.log(await page.locator("main").innerHTML().then(h=>h.replace(/<input type="hidden"[^>]*>/g,"").slice(0,2500)));
    await shot(page,"03-import-start-hy");
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
