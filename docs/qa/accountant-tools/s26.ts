import { session, shot, text } from "./lib";
(async () => {
  const { browser, page, errs } = await session("hy");
  try {
    await page.goto("/hy/app"); await page.waitForTimeout(800);
    await page.locator("#org-switch").selectOption({label:"Երկրորդ ֆիրմա"}); await page.waitForTimeout(2500);
    await page.getByRole("button",{name:"Բեռնել դեմո տվյալներ"}).click(); await page.waitForTimeout(6000);
    console.log((await text(page,1500)).split("\n").slice(12,40).join(" | "));
    await shot(page,"41-demo-loaded-hy");
    await page.getByRole("button",{name:"Բեռնել դեմո տվյալներ"}).click().catch(()=>{}); await page.waitForTimeout(3000);
    console.log("2nd click:", (await page.locator("[role=status]").allInnerTexts()).join("|"));
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
