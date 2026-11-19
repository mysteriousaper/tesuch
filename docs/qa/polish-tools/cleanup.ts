import { deleteTestUsers, admin } from "../../../tests/e2e/helpers/supabase";
import { readFileSync } from "node:fs";
(async () => {
  const u = JSON.parse(readFileSync("/tmp/claude-0/s/user.json", "utf8"));
  await deleteTestUsers([u.id]);
  const { data } = await admin().auth.admin.listUsers({ perPage: 200 });
  console.log("remaining polish users:", (data?.users ?? []).filter((x) => x.email?.includes("polish")).length);
})();
