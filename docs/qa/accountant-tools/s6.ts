import { session, shot, text } from "./lib";
(async () => {
  const { browser, page, errs } = await session("hy");
  try {
    await page.goto("/hy/app/import"); await page.waitForTimeout(800);
    await page.locator("select").selectOption({label:"Արարատ Սթիլ ՍՊԸ"});
    await page.locator("input[type=file]").setInputFiles("/tmp/claude-0/qa/hy.csv");
    await page.waitForTimeout(2000);
    await page.getByRole("button",{name:"Առաջ"}).click(); await page.waitForTimeout(2500);
    const t = await text(page,6000);
    console.log(t.slice(t.indexOf("Վերնագիր")>0?0:600));
    await shot(page,"06-import-preview-hy");
    await shot(page,"06b-import-preview-hy-full", true);
    await page.getByRole("button",{name:/Ներմուծել/}).last().click(); await page.waitForTimeout(8000);
    console.log("AFTER", await text(page,2500));
    await shot(page,"07-import-done-hy");
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
