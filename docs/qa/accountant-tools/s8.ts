import { session, shot, text } from "./lib";
(async () => {
  const { browser, page, errs } = await session("hy");
  try {
    await page.goto("/hy/app/companies/cb6f5570-118e-430e-b4c9-227160491f9a"); await page.waitForTimeout(1500);
    const list = page.locator("section", {has: page.getByRole("heading",{name:"Խնդիրներ"})}).first();
    await shot(page,"11-after-fix-dismiss-recheck");
    await page.locator("a[href*=\"/employees/\"]").first().click(); await page.waitForTimeout(2500);
    await page.locator("a[href*='/employees/']").first().click(); await page.waitForTimeout(2500);
    console.log("EMP", page.url()); console.log(await text(page,3500));
    await shot(page,"12-employee-timeline-hy", true);
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
