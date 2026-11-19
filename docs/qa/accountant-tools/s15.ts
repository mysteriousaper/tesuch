import { session, shot, text } from "./lib";
(async () => {
  const { browser, page, errs } = await session("ru");
  try {
    for (const [p,n] of [["members","22-team-ru"],["audit","23-audit-ru"],["settings","24-settings-ru"],["quiz","25-quiz-ru"],["members/data","26-data-ru"]]) {
      await page.goto(`/ru/app/${p}`); await page.waitForTimeout(1500);
      console.log("=====",p); console.log((await text(page,2500)).split("\n").slice(12).join(" | "));
      await shot(page,n);
    }
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
