import { session, shot, text } from "./lib";
import { admin } from "../../../tests/e2e/helpers/supabase";
import fs from "node:fs";
(async () => {
  const { browser, ctx, page } = await session("hy");
  try {
    const {data:c}=await admin().from("contracts").select("id").eq("employee_id","0207454f-c91b-448f-b0c6-a534a3ea4008").single();
    const get = async (u:string,n:string)=>{const r=await ctx.request.get(u); fs.writeFileSync(`/tmp/claude-0/qa/${n}.pdf`, await r.body()); console.log(n, r.status(), r.headers()["content-disposition"]);};
    await get(`/api/pdf/dismissal?contract=${c!.id}`,"doc-dismissal");
    await get(`/api/pdf/dismissal?contract=${c!.id}&date=2026-11-10&termination=2026-11-18`,"doc-dismissal2");
    await get(`/api/pdf/checklist?company=cb6f5570-118e-430e-b4c9-227160491f9a&locale=ru`,"doc-checklist-ru");
    await get(`/api/pdf/checklist?company=31dec1b4-2ea8-423d-b53e-ccf4f4e94d1e&locale=hy`,"doc-checklist-empty");
    const r=await ctx.request.get(`/api/pdf/checklist?company=00000000-0000-4000-8000-000000000000&locale=hy`); console.log("bad", r.status(), r.headers()["content-type"], (await r.text()).slice(0,200));
  } finally { await browser.close(); }
})();
