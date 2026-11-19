import { session, shot, text } from "./lib";
(async () => {
  const { browser, page, errs } = await session("ru");
  try {
    await page.goto("/ru/app/import"); await page.waitForTimeout(1000);
    await page.locator("select").selectOption({label:"Эребуни Строй"});
    await page.locator("input[type=file]").setInputFiles("/tmp/claude-0/qa/ru.xlsx");
    await page.waitForTimeout(2500);
    const t = await text(page,600); console.log(t.slice(300,600));
    await shot(page,"19-import-xlsx-mapping-ru");
    await page.getByRole("button",{name:/Далее/}).click(); await page.waitForTimeout(2500);
    console.log((await text(page,2500)).slice(200,1600));
    await page.getByRole("button",{name:/Импортировать/}).last().click(); await page.waitForTimeout(7000);
    console.log((await text(page,2500)).slice(300,1200));
    await shot(page,"20-import-done-ru");
    await page.goto("/ru/app"); await page.waitForTimeout(1500);
    await shot(page,"21-dashboard-ru");
    console.log((await text(page,900)).slice(100,900));
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
