import { session, shot, text } from "./lib";
(async () => {
  const { browser, page } = await session("hy");
  try {
    await page.goto("/hy/app"); await page.waitForTimeout(800);
    await page.locator("#org-switch").selectOption({label:"Երկրորդ ֆիրմա"}); await page.waitForTimeout(2500);
    await page.reload(); await page.waitForTimeout(1500);
    console.log((await text(page,1500)).split("\n").slice(12,60).join(" | "));
    await shot(page,"41-demo-loaded-hy");
    const c = await page.locator("main a[href*='/companies/']").first(); await c.click(); await page.waitForTimeout(1500);
    console.log("company page buttons:", await page.getByRole("button").allInnerTexts());
  } finally { await browser.close(); }
})();
