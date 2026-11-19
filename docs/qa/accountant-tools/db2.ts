import { admin } from "../../../tests/e2e/helpers/supabase";
import fs from "node:fs";
(async()=>{
  const u = JSON.parse(fs.readFileSync("/tmp/claude-0/qa/user.json","utf8"));
  const db=admin();
  const {data:m}=await db.from("memberships").select("org_id").eq("user_id",u.id).single();
  const {data:f,error}=await db.from("findings").select("*").eq("org_id",m!.org_id).limit(3);
  console.log(error?.message, f);
  const {data:all}=await db.from("findings").select("rule_id,severity,status").eq("org_id",m!.org_id).limit(2000);
  const c:Record<string,number>={}; all?.forEach(x=>{const k=`${x.rule_id}|${x.severity}|${x.status}`;c[k]=(c[k]||0)+1}); console.log(c);
})();
