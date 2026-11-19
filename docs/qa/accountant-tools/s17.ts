import { session, shot, text, boot, signInViaUi, SHOTS } from "./lib";
import { admin } from "../../../tests/e2e/helpers/supabase";
import fs from "node:fs";
(async () => {
  const extra = JSON.parse(fs.readFileSync("/tmp/claude-0/qa/extra.json","utf8"));
  const { data } = await admin().from("invitations").select("email,role,token").in("email",[extra.accountant.email, extra.viewer.email]);
  console.log(data?.map(d=>d.email.slice(0,25)+" "+d.role));
  for (const role of ["accountant","viewer"] as const) {
    const tok = data!.find(d=>d.role===role)?.token;
    const b = await boot(extra[role], "ru");
    try {
      await signInViaUi(b.page, extra[role], "ru");
      console.log(role, "landing:", (await text(b.page, 400)).split("\n").slice(12).join(" | "));
      await b.page.goto(`/ru/invite/${tok}`); await b.page.waitForTimeout(1500);
      console.log(role, "invite page:", (await text(b.page, 600)).split("\n").slice(4).join(" | "));
      await b.page.locator("main form button").first().click(); await b.page.waitForTimeout(3000);
      console.log(role, "after accept URL:", b.page.url());
      await b.page.goto("/ru/app"); await b.page.waitForTimeout(1500);
      console.log(role, "dash:", (await text(b.page,900)).split("\n").slice(12,30).join(" | "));
      await shot(b.page, `28-${role}-dashboard-ru`);
      for (const p of ["members","audit","members/data","import","settings"]) {
        await b.page.goto(`/ru/app/${p}`); await b.page.waitForTimeout(1200);
        console.log(role, p, "=>", b.page.url().replace("http://localhost:3301",""), "|", (await text(b.page,500)).split("\n").slice(12,22).join(" | "));
      }
      // company page as role
      await b.page.goto("/ru/app/companies/cb6f5570-118e-430e-b4c9-227160491f9a"); await b.page.waitForTimeout(1500);
      const btns = await b.page.getByRole("button",{name:"Исправлено"}).count(); const rc = await b.page.getByRole("button",{name:/Проверить/}).count();
      console.log(role, "fix buttons", btns, "recheck", rc);
      if (role==="viewer") await shot(b.page, "29-viewer-company-ru");
      console.log(role,"ERRS",b.errs);
    } finally { await b.browser.close(); }
  }
})();
