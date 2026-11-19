import { session, shot, text, boot, createTestUser, deleteTestUsers, signInViaUi } from "./lib";
(async () => {
  const { browser, page, errs } = await session("hy");
  try {
    await page.goto("/hy/app/quiz"); await page.waitForTimeout(1500);
    const groups = page.locator("fieldset"); console.log("fieldsets", await groups.count());
    for (let i=0;i<await groups.count();i++) await groups.nth(i).locator("input[type=radio]").first().check();
    await shot(page,"35-quiz-hy",true);
    await page.locator("main form button").last().click(); await page.waitForTimeout(3000);
    console.log((await text(page,3000)).split("\n").slice(12).join(" | ").slice(0,1500));
    await shot(page,"36-quiz-result-hy",true);
  } finally { console.log("ERRS", errs); await browser.close(); }
  // consent gate
  const u = await createTestUser("gate",{consent:false});
  const b = await boot(u,"hy");
  try {
    await signInViaUi(b.page,u,"hy","consent");
    console.log("CONSENT URL", b.page.url());
    console.log((await text(b.page,2500)).split("\n").slice(4).join(" | "));
    await shot(b.page,"37-consent-hy");
    await b.page.goto("/hy/app"); await b.page.waitForTimeout(1000); console.log("bypass /app ->", b.page.url());
  } finally { await b.browser.close(); await deleteTestUsers([u.id]); }
})();
