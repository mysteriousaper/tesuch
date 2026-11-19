import { session, shot, text } from "./lib";
(async () => {
  const { browser, page, errs } = await session("hy");
  try {
    if (await page.locator("#name").count()) {
      await page.locator("#name").fill("Արմ Հաշվապահ ՍՊԸ");
      await page.locator("main form button").click();
      await page.waitForTimeout(2500);
    }
    console.log(await text(page));
    await shot(page, "01-dashboard-empty-hy");
    console.log(await page.locator("main").innerHTML().then(h=>h.replace(/<input type="hidden"[^>]*>/g,"").slice(0,3500)));
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
