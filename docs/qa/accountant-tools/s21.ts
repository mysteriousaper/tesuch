import { session, shot, text } from "./lib";
(async () => {
  const { browser, page, errs } = await session("ru");
  const run = async (company:string, file:string, label:string, shotName?:string) => {
    await page.goto("/ru/app/import"); await page.waitForTimeout(900);
    await page.locator("select").selectOption({label:company});
    await page.locator("input[type=file]").setInputFiles(file);
    await page.waitForTimeout(2500);
    let t = await text(page,1500);
    console.log("=====",label); console.log(t.split("\n").slice(12,40).join(" | ").slice(0,900));
    if (shotName) await shot(page, shotName);
    const next = page.getByRole("button",{name:/Далее/}); 
    if (await next.count() && await next.isEnabled()) { await next.click(); await page.waitForTimeout(2500); console.log("PREVIEW:", (await text(page,1500)).split("\n").slice(12,30).join(" | ").slice(0,900)); }
    return page;
  };
  try {
    await run("Эребуни Строй","/tmp/claude-0/qa/ru-1251.csv","cp1251 csv");
    await run("Эребуни Строй","/tmp/claude-0/qa/en.csv","english csv");
    await run("Эребуни Строй","/tmp/claude-0/qa/notes.txt","txt file");
    // re-import hy.csv into Arарат
    await run("Արարատ Սթիլ ՍՊԸ","/tmp/claude-0/qa/hy.csv","re-import same hy.csv");
    await page.getByRole("button",{name:/Импортировать/}).last().click(); await page.waitForTimeout(8000);
    console.log("REIMPORT RESULT:", (await text(page,1500)).split("\n").slice(24,40).join(" | "));
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
