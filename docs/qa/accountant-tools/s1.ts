import { boot, createTestUser, deleteTestUsers, signInViaUi, SHOTS } from "./lib";
(async () => {
  const u = await createTestUser("acc");
  const { browser, page, errs } = await boot(u);
  try {
    await signInViaUi(page, u, "hy");
    await page.waitForLoadState("networkidle");
    console.log("URL", page.url());
    console.log((await page.locator("body").innerText()).slice(0, 1500));
    await page.screenshot({ path: `/tmp/claude-0/qa/a1.png` });
  } finally { console.log("ERRS", errs); await browser.close(); await deleteTestUsers([u.id]); }
})();
