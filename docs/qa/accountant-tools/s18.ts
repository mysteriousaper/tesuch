import { text, boot, signInViaUi } from "./lib";
import fs from "node:fs";
(async () => {
  const extra = JSON.parse(fs.readFileSync("/tmp/claude-0/qa/extra.json","utf8"));
  for (const role of ["accountant","viewer"] as const) {
    const b = await boot(extra[role], "ru");
    try {
      await signInViaUi(b.page, extra[role], "ru");
      for (const p of ["","members","audit","members/data","import","settings","documents","quiz","companies/cb6f5570-118e-430e-b4c9-227160491f9a"]) {
        b.errs.length = 0;
        await b.page.goto(`/ru/app/${p}`); await b.page.waitForTimeout(1800);
        if (b.errs.length) console.log(role, p, b.errs);
      }
    } finally { await b.browser.close(); }
  }
})();
