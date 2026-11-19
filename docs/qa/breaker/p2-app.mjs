// Probe 2: route handlers, org cookie, forced membership and audit-log erasure against the local build.
// Needs the app on APP_URL (default http://localhost:3303).
import { APP, admin, cleanup, cookieFor, createUser, report, signIn } from "./lib.mjs";

const get = (path, cookie, headers = {}) => fetch(APP + path, { headers: { cookie: cookie ?? "", ...headers }, redirect: "manual" });

try {
  const [ownA, ownB, victim, viewer] = await Promise.all(["ownA", "ownB", "victim", "viewer"].map((l) => createUser(l)));
  const sA = await signIn(ownA);
  const sB = await signIn(ownB);
  const sVi = await signIn(victim);
  const sV = await signIn(viewer);
  const A = sA.client, B = sB.client, VI = sVi.client;

  const { data: orgA } = await A.rpc("create_org", { p_name: "Breaker A" });
  const { data: orgB } = await B.rpc("create_org", { p_name: "Breaker B" });
  const { data: orgVi } = await VI.rpc("create_org", { p_name: "Victim Audit LLC" });
  const { data: inv } = await A.from("invitations").insert({ org_id: orgA, email: viewer.email, role: "viewer" }).select("token").single();
  await sV.client.rpc("accept_invitation", { p_token: inv.token });

  const { data: coA } = await A.from("companies").insert({ org_id: orgA, name: "Co A" }).select("id").single();
  const { data: empA } = await A.from("employees").insert({ org_id: orgA, company_id: coA.id, full_name: "Anna Secret", birth_date: "1990-05-05" }).select("id").single();
  const { data: ctA } = await A.from("contracts").insert({ org_id: orgA, employee_id: empA.id, type: "fixed_term", start_date: "2026-01-01", end_date: "2026-12-31", probation_end: "2026-03-01" }).select("id").single();

  const cA = cookieFor(sA.session), cB = cookieFor(sB.session), cVi = cookieFor(sVi.session), cV = cookieFor(sV.session);

  // ---- PDF routes cross-tenant
  for (const p of [`/api/pdf/probation?contract=${ctA.id}`, `/api/pdf/fixed-term-end?contract=${ctA.id}`, `/api/pdf/dismissal?contract=${ctA.id}&date=2026-06-01`, `/api/pdf/checklist?company=${coA.id}`]) {
    const own = await get(p, cA);
    const other = await get(p, cB);
    const none = await get(p, "");
    report(`PDF ${p.split("?")[0]}: other tenant`, other.status === 404, `owner ${own.status} ${own.headers.get("content-type")}, B ${other.status}, anon ${none.status}`);
  }
  // ---- exports
  let r = await get(`/en/app/members/data/employees/${empA.id}`, cB);
  report("employee export by other tenant", r.status === 404, `HTTP ${r.status}`);
  r = await get(`/en/app/members/data/export`, cV, { cookie: cV + `; tesuch_org=${orgA}` });
  report("org export by viewer", r.status === 403, `HTTP ${r.status}`);
  r = await get(`/en/app/members/data/export`, cB + `; tesuch_org=${orgA}`);
  const body = await r.text();
  report("org export by B with org cookie forged to A", !body.includes("Anna Secret"), `HTTP ${r.status}, contains A data: ${body.includes("Anna Secret")}`);

  // ---- org cookie forged on dashboard
  r = await get(`/en/app`, cB + `; tesuch_org=${orgA}`);
  const html = await r.text();
  report("dashboard with org cookie forged to A", !html.includes("Breaker A"), `HTTP ${r.status}, shows "Breaker A": ${html.includes("Breaker A")}`);

  // ---- route auth
  r = await fetch(APP + "/api/jobs/nightly");
  report("nightly without secret", r.status === 401, `HTTP ${r.status}`);
  r = await fetch(APP + "/api/jobs/nightly", { headers: { authorization: "Bearer " + "0".repeat(64) } });
  report("nightly wrong secret", r.status === 401, `HTTP ${r.status}`);
  r = await fetch(APP + "/api/telegram/webhook", { method: "POST", body: "{}" });
  report("telegram webhook without secret", r.status === 401, `HTTP ${r.status}`);
  r = await fetch(APP + "/api/health");
  report("health leaks nothing sensitive", !/supabase|key|secret/i.test(await r.text()), `HTTP ${r.status}`);

  // ---- auth callback open redirect
  for (const next of ["//evil.com", "/hy//evil.com", "https://evil.com", "/\\evil.com", "/hy/app%2F..%2F..%2F%2Fevil.com", "/en/app\n/x", "/hy/../../evil"]) {
    r = await fetch(`${APP}/api/auth/callback?code=x&next=${encodeURIComponent(next)}`, { redirect: "manual" });
    const loc = r.headers.get("location") ?? "";
    report(`callback next=${JSON.stringify(next)}`, new URL(loc, APP).host === new URL(APP).host, loc);
  }

  // ---- response headers
  r = await get("/en", "");
  const h = Object.fromEntries(r.headers);
  report("Content-Security-Policy header on HTML", !!h["content-security-policy"], h["content-security-policy"] ?? "missing");
  report("Strict-Transport-Security header", !!h["strict-transport-security"], h["strict-transport-security"] ?? "missing (Vercel adds it on *.vercel.app; custom domains too)");

  // ---- forced membership with backdated created_at hijacks the victim's default org
  r = await A.from("memberships").insert({ user_id: victim.id, org_id: orgA, role: "owner", created_at: "2000-01-01T00:00:00Z" }).select();
  report("owner A force-adds victim as owner, backdated", !!r.error, r.error?.message ?? "inserted");
  await A.from("orgs").update({ name: "Victim Audit LLC" }).eq("id", orgA); // look-alike name
  r = await get(`/en/app`, cVi); // fresh browser: no tesuch_org cookie
  const vhtml = await r.text();
  const ids = [...vhtml.matchAll(/companies\/([0-9a-f-]{36})/g)].map((m) => m[1]);
  report("victim's default org after forced add", !ids.includes(coA.id), `victim dashboard lists attacker company Co A: ${ids.includes(coA.id) || vhtml.includes("Co A")}`);
  // What the victim then types lands in A's tenant (simulated with the victim's own RLS client, as the UI would):
  const { data: vco, error: vErr } = await VI.from("companies").insert({ org_id: orgA, name: "Victim client Ltd" }).select("id").single();
  const { data: seenByA } = await A.from("companies").select("name").eq("id", vco?.id ?? "00000000-0000-0000-0000-000000000000");
  console.log("   victim insert into default org:", vErr?.message ?? "ok", "| attacker reads it:", JSON.stringify(seenByA));
  void orgVi; void orgB;

  // ---- audit log keeps erased employee data
  r = await A.from("employees").delete().eq("id", empA.id).select("id");
  const { data: audit } = await A.from("audit_log").select("table_name, action, old_row").eq("org_id", orgA).eq("table_name", "employees").eq("action", "delete");
  const kept = (audit ?? []).some((a) => a.old_row?.full_name === "Anna Secret" && a.old_row?.birth_date === "1990-05-05");
  report("erased employee's name/birth date gone from audit_log", !kept, `deleted ${r.data?.length} employee; audit old_row still has full_name+birth_date: ${kept}`);
  const { data: auditAll } = await admin().from("audit_log").select("table_name, old_row, new_row").eq("org_id", orgA);
  const hits = (auditAll ?? []).filter((a) => JSON.stringify(a).includes("Anna Secret")).map((a) => a.table_name);
  console.log("   audit rows still containing the name:", hits.length, [...new Set(hits)].join(","));
} finally {
  await cleanup();
}
