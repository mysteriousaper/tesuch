import { session, shot, text } from "./lib";
import { admin } from "../../../tests/e2e/helpers/supabase";
(async () => {
  const { browser, page, errs, u } = await session("hy");
  try {
    const db = admin();
    const {data:m}=await db.from("memberships").select("org_id").eq("user_id",u.id).single();
    const rows = Array.from({length:19},(_,i)=>({org_id:m!.org_id,name:`Клиент ${i+14}`,tax_id:String(33333300+i)}));
    const r = await db.from("companies").insert(rows); console.log("ins", r.error?.message);
    await page.goto("/hy/app"); await page.waitForTimeout(1000);
    console.log("rows", await page.locator("main a[href*='/companies/']").count());
    await shot(page,"04-dashboard-32-companies-hy", true);
    // import
    await page.goto("/hy/app/import"); await page.waitForTimeout(800);
    await page.locator("select").selectOption({label:"Արարատ Սթիլ ՍՊԸ"});
    await page.locator("input[type=file]").setInputFiles("/tmp/claude-0/qa/hy.csv");
    await page.waitForTimeout(2500);
    console.log(await text(page,4000));
    await shot(page,"05-import-mapping-hy", true);
  } finally { console.log("ERRS", errs); await browser.close(); }
})();
