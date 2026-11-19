import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { runRulesForCompany } from "../../../src/lib/jobs/run";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) process.env[m[1]] = m[2]; }
for (const k of ["TELEGRAM_BOT_TOKEN","RESEND_API_KEY","ALERT_FROM_EMAIL"]) delete process.env[k];
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const u = JSON.parse(readFileSync("/tmp/claude-0/s/user.json", "utf8"));
(async () => {
  const org = (await db.from("memberships").select("org_id").eq("user_id", u.id)).data![0].org_id;
  const co = (await db.from("companies").select("id,org_id,name").eq("org_id", org)).data![0];
  const run = async (label: string) => {
    const t = Date.now();
    const r = await runRulesForCompany(db, { ...co, locale: "hy" }, "2026-11-19", { sendAlerts: false });
    console.log(label, `${Date.now() - t}ms`, "ins", r.inserted, "upd", r.updated, "reopen", r.reopened, "autoRes", r.autoResolved, "score", r.score, r.computed.map((f) => `${f.ruleId}:${f.severity}`).join(","));
  };
  await run("baseline");
  const g = (await db.from("employees").select("id").eq("org_id", org).eq("full_name", "Գևորգ Պետրոսյան")).data![0];
  await db.from("contracts").update({ end_date: "2026-11-14" }).eq("employee_id", g.id);
  await run("fixed-term ended 5 days ago, no termination");
  await db.from("contracts").update({ end_date: "2026-12-01" }).eq("employee_id", g.id);
  const a = (await db.from("employees").select("id").eq("org_id", org).eq("full_name", "Անահիտ Սարգսյան")).data![0];
  await db.from("contracts").update({ probation_end: "2026-11-10", start_date: "2026-08-20" }).eq("employee_id", a.id);
  await run("probation ended 9 days ago, still employed (indefinite)");
  await db.from("contracts").update({ probation_end: "2026-11-26" }).eq("employee_id", a.id);
  await run("probation ends in 7 days");
  const fs = (await db.from("findings").select("rule_id,status,severity").eq("company_id", co.id)).data;
  console.log(JSON.stringify(fs));
})();
