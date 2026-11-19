import { session, shot, text } from "./lib";
(async () => {
  const { browser, page, errs } = await session("hy");
  try {
    const f = page.locator("aside form").first();
    const add = async (n: string, tax: string) => {
      await page.waitForFunction(() => (document.querySelector("aside input[name=name]") as HTMLInputElement)?.value === "" , null, {timeout: 8000}).catch(()=>{});
      await f.locator('input[name=name]').fill(n);
      await f.locator('input[name=tax_id]').fill(tax);
      await f.locator("button[type=submit]").click();
      await page.waitForTimeout(2500);
      return (await f.locator("[role=status]").innerText()) + " | nameval=" + await f.locator('input[name=name]').inputValue();
    };
    const names = ["Գառնի Տրեյդ ՓԲԸ","Նաիրի Ֆուդս","ООО «Ромашка»","Дилижан Резорт"];
    for (let i=0;i<names.length;i++) console.log(names[i], await add(names[i], String(22222220+i)));
    console.log("dup name:", await add("Սևան Տուր ՍՊԸ", ""));
    console.log("dup tax:", await add("Another", "22222220"));
    const {} = {};
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
