import { deleteTestUsers, admin } from "../../../tests/e2e/helpers/supabase";
import fs from "node:fs";
(async () => {
  const ids: string[] = [];
  const u = JSON.parse(fs.readFileSync("/tmp/claude-0/qa/user.json","utf8")); ids.push(u.id);
  const e = JSON.parse(fs.readFileSync("/tmp/claude-0/qa/extra.json","utf8")); ids.push(e.accountant.id, e.viewer.id);
  const db = admin();
  // orgs where main user is owner (two firms) are removed by deleteTestUsers
  await deleteTestUsers(ids);
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  console.log("remaining qa users:", data.users.filter(x=>(x.email??"").startsWith("qa-e-")).length);
  for (const id of ids) { const r = await db.from("memberships").select("org_id").eq("user_id", id); if (r.data?.length) console.log("membership left", id); }
})();
