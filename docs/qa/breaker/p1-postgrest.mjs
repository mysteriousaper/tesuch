// Probe 1: tenant isolation and role escalation straight through PostgREST with user JWTs.
import { admin, cleanup, createUser, report, signIn } from "./lib.mjs";

try {
  const [ownA, ownB, acc, viewer, outsider] = await Promise.all(
    ["ownA", "ownB", "acc", "viewer", "out"].map((l) => createUser(l)),
  );
  const A = (await signIn(ownA)).client;
  const B = (await signIn(ownB)).client;
  const ACC = (await signIn(acc)).client;
  const V = (await signIn(viewer)).client;
  const O = (await signIn(outsider)).client;

  const { data: orgA } = await A.rpc("create_org", { p_name: "Breaker A" });
  const { data: orgB } = await B.rpc("create_org", { p_name: "Breaker B" });
  // Members via the real invitation flow.
  for (const [u, c, role] of [[acc, ACC, "accountant"], [viewer, V, "viewer"]]) {
    const { data: inv, error } = await A.from("invitations").insert({ org_id: orgA, email: u.email, role }).select("token").single();
    if (error) throw new Error(`invite: ${error.message}`);
    const { error: e2 } = await c.rpc("accept_invitation", { p_token: inv.token });
    if (e2) throw new Error(`accept: ${e2.message}`);
  }
  const { data: coA } = await A.from("companies").insert({ org_id: orgA, name: "Co A" }).select("id").single();
  const { data: coB } = await B.from("companies").insert({ org_id: orgB, name: "Co B" }).select("id").single();
  const { data: empA } = await A.from("employees").insert({ org_id: orgA, company_id: coA.id, full_name: "Emp A", birth_date: "1990-01-01" }).select("id").single();

  // ---- cross-tenant reads
  for (const t of ["orgs", "companies", "employees", "memberships", "invitations", "audit_log", "findings", "contracts", "consent_records", "telegram_links", "telegram_link_tokens", "leads", "quiz_attempts", "alerts_log"]) {
    const { data, error } = await B.from(t).select("*");
    const leaked = (data ?? []).filter((r) => r.org_id === orgA || r.id === orgA || r.user_id === ownA.id);
    report(`B reads ${t} of A`, !leaked.length, error ? error.message : `${data?.length ?? 0} rows visible, ${leaked.length} from A`);
  }

  // ---- cross-tenant writes
  let r = await B.from("employees").insert({ org_id: orgB, company_id: coA.id, full_name: "x" });
  report("B inserts employee into A's company (forged company_id)", !!r.error, r.error?.message);
  r = await B.from("employees").update({ full_name: "pwned" }).eq("id", empA.id).select();
  report("B updates A's employee", !r.data?.length, `${r.data?.length ?? 0} rows`);
  r = await B.from("memberships").insert({ user_id: ownB.id, org_id: orgA, role: "owner" });
  report("B inserts itself as owner of A", !!r.error, r.error?.message);
  r = await B.from("invitations").insert({ org_id: orgA, email: ownB.email, role: "owner" });
  report("B invites itself into A", !!r.error, r.error?.message);
  r = await B.from("orgs").update({ name: "pwned" }).eq("id", orgA).select();
  report("B renames A", !r.data?.length, `${r.data?.length ?? 0} rows`);
  r = await B.from("companies").update({ org_id: orgB }).eq("id", coA.id).select();
  report("B moves A's company", !r.data?.length, `${r.data?.length ?? 0} rows`);

  // ---- role escalation inside A
  r = await V.from("companies").insert({ org_id: orgA, name: "viewer co" });
  report("viewer inserts company", !!r.error, r.error?.message);
  r = await V.from("memberships").update({ role: "owner" }).eq("user_id", viewer.id).eq("org_id", orgA).select();
  report("viewer self-promotes to owner", !r.data?.length, `${r.data?.length ?? 0} rows ${r.error?.message ?? ""}`);
  r = await ACC.from("memberships").update({ role: "owner" }).eq("user_id", acc.id).eq("org_id", orgA).select();
  report("accountant self-promotes to owner", !r.data?.length, `${r.data?.length ?? 0} rows ${r.error?.message ?? ""}`);
  r = await ACC.from("invitations").insert({ org_id: orgA, email: outsider.email, role: "owner" });
  report("accountant invites an owner", !!r.error, r.error?.message);
  r = await ACC.from("invitations").select("token");
  report("accountant reads invitation tokens", !r.data?.length, `${r.data?.length ?? 0} rows`);
  r = await ACC.from("audit_log").select("id").eq("org_id", orgA);
  report("accountant reads audit log", !r.data?.length, `${r.data?.length ?? 0} rows`);
  r = await V.from("employees").delete().eq("id", empA.id).select();
  report("viewer deletes employee", !r.data?.length, `${r.data?.length ?? 0} rows`);

  // ---- last-owner guard
  r = await A.from("memberships").update({ role: "viewer" }).eq("user_id", ownA.id).eq("org_id", orgA).select();
  report("sole owner demotes self", !!r.error, r.error?.message);
  r = await A.from("memberships").delete().eq("user_id", ownA.id).eq("org_id", orgA).select();
  report("sole owner removes self", !!r.error, r.error?.message);
  // Moving the sole owner's row to another org the user owns (owner of both A and C).
  const { data: orgC } = await A.rpc("create_org", { p_name: "Breaker C" });
  r = await A.from("memberships").update({ org_id: orgC }).eq("user_id", ownA.id).eq("org_id", orgA).select();
  report("sole owner moves own membership row to another org", !!r.error, r.error?.message ?? `${r.data?.length} rows`);

  // ---- owner adds an arbitrary user (no consent) by user id
  r = await A.from("memberships").insert({ user_id: outsider.id, org_id: orgA, role: "viewer" }).select();
  report("owner force-adds a user who never accepted an invitation", !!r.error, r.error?.message ?? `${r.data?.length} rows inserted`);
  if (!r.error) {
    const { data: seen } = await O.from("orgs").select("id,name");
    console.log("   outsider now sees orgs:", JSON.stringify(seen));
  }

  // ---- RPC abuse
  r = await O.rpc("invitation_preview", { p_token: "0".repeat(64) });
  report("invitation_preview with a guessed token", !r.data?.length, JSON.stringify(r.data));
  r = await O.rpc("accept_invitation", { p_token: "' or true --" });
  report("accept_invitation SQLi-style token", !!r.error, r.error?.message);
  r = await anonCall("create_org", { p_name: "anon org" });
  report("anon create_org", r.status >= 400, `HTTP ${r.status}`);
  r = await anonCall("create_telegram_link_token", {});
  report("anon create_telegram_link_token", r.status >= 400, `HTTP ${r.status}`);
  r = await anonCall("submit_lead", { p_email: "a@b.cd", p_locale: "en", p_score: 1, p_answers: {}, p_company_size: null, p_role: null, p_consent: true });
  report("anon submit_lead (S-1 fix)", r.status >= 400, `HTTP ${r.status}`);
  r = await O.rpc("submit_lead", { p_email: "a@b.cd", p_locale: "en", p_score: 1, p_answers: {}, p_company_size: null, p_role: null, p_consent: true });
  report("authenticated submit_lead", !!r.error, r.error?.message);

  // ---- consent forgery
  r = await O.from("consent_records").insert({ user_id: ownA.id, document: "terms", version: "x" });
  report("insert consent for another user", !!r.error, r.error?.message);
  r = await O.from("consent_records").update({ version: "zzz" }).eq("user_id", outsider.id).select();
  report("rewrite own consent record", !r.data?.length, `${r.data?.length ?? 0} rows`);

  // ---- telegram token / link tables
  r = await O.from("telegram_links").insert({ user_id: outsider.id, chat_id: 1 });
  report("user links an arbitrary telegram chat directly", !!r.error, r.error?.message);
  r = await O.from("telegram_link_tokens").select("*");
  report("user lists link tokens", !r.data?.length, `${r.data?.length ?? 0} rows`);

  void admin;
} finally {
  await cleanup();
}

async function anonCall(fn, body) {
  return fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
