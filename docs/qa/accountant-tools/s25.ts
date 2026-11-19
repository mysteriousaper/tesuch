import { session, shot, text } from "./lib";
import fs from "node:fs";
(async () => {
  const { browser, ctx, page, u } = await session("ru");
  try {
    // switch back to first org
    await page.goto("/ru/app"); await page.waitForTimeout(800);
    await page.locator("#org-switch").selectOption({label:"Արմ Հաշվապահ ՍՊԸ"}); await page.waitForTimeout(2500);
    const r = await ctx.request.get("/ru/app/members/data/export");
    console.log("export", r.status(), r.headers()["content-disposition"]);
    const j = JSON.parse((await r.body()).toString("utf8"));
    console.log(Object.keys(j), Object.fromEntries(Object.entries(j.data ?? j).map(([k,v]:any)=>[k,Array.isArray(v)?v.length:typeof v])));
    // delete employee flow
    await page.goto("/ru/app/members/data"); await page.waitForTimeout(1200);
    await page.locator("input[type=search], input[name=q]").first().fill("Тестов Сотрудник 7");
    await page.getByRole("button",{name:"Найти"}).click(); await page.waitForTimeout(1500);
    await page.getByRole("button",{name:/Удалить/}).first().click(); await page.waitForTimeout(600);
    await shot(page,"40-delete-employee-modal-ru");
    console.log((await page.locator("dialog, [role=dialog]").first().innerText().catch(()=>"nodialog")).replace(/\n/g," | "));
  } finally { await browser.close(); }
})();
