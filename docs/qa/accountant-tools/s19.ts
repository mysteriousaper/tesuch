import { session, shot, text } from "./lib";
(async () => {
  const { browser, page, errs } = await session("hy");
  try {
    await page.goto("/hy/app/settings"); await page.waitForTimeout(1500);
    console.log((await text(page,2000)).split("\n").slice(12).join(" | "));
    await shot(page,"30-settings-hy");
    console.log(await page.locator("main").innerHTML().then(h=>h.replace(/<input type="hidden"[^>]*>/g,"").replace(/class="[^"]*"/g,"").slice(0,2500)));
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
