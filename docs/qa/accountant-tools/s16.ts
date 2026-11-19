import { session, shot, text, boot, createTestUser, signInViaUi } from "./lib";
import fs from "node:fs";
(async () => {
  const { browser, page, errs } = await session("ru");
  const extra: any = fs.existsSync("/tmp/claude-0/qa/extra.json") ? JSON.parse(fs.readFileSync("/tmp/claude-0/qa/extra.json","utf8")) : {};
  try {
    for (const role of ["accountant","viewer"]) {
      if (!extra[role]) extra[role] = await createTestUser(role);
      fs.writeFileSync("/tmp/claude-0/qa/extra.json", JSON.stringify(extra));
      await page.goto("/ru/app/members"); await page.waitForTimeout(1200);
      const f = page.locator("main form").first();
      await f.locator("input[type=email]").fill(extra[role].email);
      await f.locator("select").selectOption(role==="accountant"?"accountant":"viewer");
      await f.locator("button[type=submit]").click(); await page.waitForTimeout(3000);
      const body = await page.locator("main").innerText();
      const m = body.match(/https?:\/\/\S+\/invite\/\S+/); console.log(role, "link:", m?.[0]?.slice(0,70));
      extra[role].link = m?.[0];
      fs.writeFileSync("/tmp/claude-0/qa/extra.json", JSON.stringify(extra));
      if (role==="accountant") await shot(page,"27-invite-link-ru");
    }
    console.log((await text(page,1800)).split("\n").slice(12).join(" | "));
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
