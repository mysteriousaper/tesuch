import { session, shot, text } from "./lib";
(async () => {
  const { browser, page, errs } = await session("hy");
  try {
    await page.goto("/hy/app/settings"); await page.waitForTimeout(1200);
    await page.locator("details summary").click();
    await page.locator("details input[name=name]").fill("Երկրորդ ֆիրմա");
    await page.locator("details button").click(); await page.waitForTimeout(3000);
    console.log("URL", page.url());
    console.log((await text(page,900)).split("\n").slice(0,20).join(" | "));
    await shot(page,"39-second-firm-hy");
    const sw = page.locator("select").first(); console.log("switcher count", await page.locator("header select, nav select").count());
    await page.goto("/hy/app"); await page.waitForTimeout(1000);
    console.log(await page.locator("body").innerHTML().then(h=>(h.match(/<select[^>]*>.*?<\/select>/s)||["none"])[0].slice(0,500)));
    // audit page hy
    await page.goto("/hy/app/audit"); await page.waitForTimeout(1200);
    console.log((await text(page,1500)).split("\n").slice(12,40).join(" | "));
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
