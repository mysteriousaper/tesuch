import { session, shot, text } from "./lib";
import { admin } from "../../../tests/e2e/helpers/supabase";
(async () => {
  const { browser, page, u } = await session("ru");
  try {
    const db = admin();
    const {data:m}=await db.from("memberships").select("org_id").eq("user_id",u.id).single();
    const {data:co}=await db.from("companies").select("id").eq("org_id",m!.org_id).eq("name","Клиент 14").single();
    const rows = Array.from({length:900},(_,i)=>({org_id:m!.org_id,company_id:co!.id,full_name:`Тестов Сотрудник ${i}`}));
    for (let i=0;i<rows.length;i+=300){ const r=await db.from("employees").insert(rows.slice(i,i+300)); if(r.error) console.log(r.error.message); }
    const {count}=await db.from("employees").select("id",{count:"exact",head:true}).eq("org_id",m!.org_id); console.log("true employee count",count);
    await page.goto("/ru/app"); await page.waitForTimeout(1500);
    const t=await text(page,700); console.log(t.split("\n").slice(12,22).join(" | "));
    const row = await page.locator("main a[href*='/companies/']", {hasText:"Клиент 14"}).first().innerText(); console.log("Клиент 14 row:", row.replace(/\n/g," | "));
    await shot(page,"38-dashboard-staff-count-capped-ru");
  } finally { await browser.close(); }
})();
