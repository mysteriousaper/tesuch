import { admin } from "../../../tests/e2e/helpers/supabase";
import fs from "node:fs";
(async()=>{
  const u = JSON.parse(fs.readFileSync("/tmp/claude-0/qa/user.json","utf8"));
  const db=admin();
  const {data:m}=await db.from("memberships").select("org_id,role").eq("user_id",u.id);
  console.log(m);
  const {data:c}=await db.from("companies").select("id,name,tax_id,created_at").eq("org_id",m![0].org_id).order("created_at");
  console.log(c?.length, c?.map(x=>x.name+"|"+x.tax_id));
})();
