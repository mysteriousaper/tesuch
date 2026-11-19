// Probe 3: invitation abuse, consent gate, server actions called directly, and input abuse.
import { APP, admin, cleanup, cookieFor, createUser, report, signIn } from "./lib.mjs";
import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync(new URL("../../../.next/server/server-reference-manifest.json", import.meta.url), "utf8"));
const actionId = (name, page) =>
  Object.entries(manifest.node).find(([, v]) => v.exportedName === name && (!page || Object.keys(v.workers).some((w) => w.includes(page))))?.[0];

/** Calls a server action the way the React client does for plain (non-FormData) arguments. */
async function callAction(name, page, path, args, cookie = "") {
  const res = await fetch(APP + path, {
    method: "POST",
    headers: { "next-action": actionId(name, page), "content-type": "text/plain;charset=UTF-8", accept: "text/x-component", cookie },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  return { status: res.status, body: text.split("\n").filter((l) => l.startsWith("1:")).join(" ") };
}

try {
  const [own, inv1, inv2, other, noConsent] = await Promise.all([
    createUser("own"), createUser("inv1"), createUser("inv2"), createUser("other"), createUser("nocons", { consent: false }),
  ]);
  const O = (await signIn(own)).client;
  const I1 = (await signIn(inv1)).client;
  const I2 = (await signIn(inv2)).client;
  const X = (await signIn(other)).client;
  const sN = await signIn(noConsent);
  const N = sN.client;
  const { data: org } = await O.rpc("create_org", { p_name: "Breaker Inv" });

  // ---- invitations
  let { data: t1 } = await O.from("invitations").insert({ org_id: org, email: inv1.email, role: "accountant" }).select("id, token").single();
  let r = await X.rpc("accept_invitation", { p_token: t1.token });
  report("invite: other email accepts", !!r.error, r.error?.message);
  r = await X.rpc("invitation_preview", { p_token: t1.token });
  console.log("   preview for a non-invitee token holder:", JSON.stringify(r.data));
  r = await I1.rpc("accept_invitation", { p_token: t1.token });
  report("invite: invitee accepts", !r.error, r.error?.message ?? "ok");
  r = await I1.rpc("accept_invitation", { p_token: t1.token });
  report("invite: token reuse", !!r.error, r.error?.message);
  r = await O.from("invitations").insert({ org_id: org, email: inv2.email.toUpperCase(), role: "owner" });
  report("invite: upper-case email stored as-is", !!r.error, r.error?.message);
  r = await O.from("invitations").insert({ org_id: org, email: ` ${inv2.email}`, role: "owner" });
  report("invite: padded email", !!r.error, r.error?.message);
  const { data: t2 } = await O.from("invitations").insert({ org_id: org, email: inv2.email, role: "owner" }).select("id, token").single();
  await admin().from("invitations").update({ expires_at: "2020-01-01T00:00:00Z" }).eq("id", t2.id);
  r = await I2.rpc("accept_invitation", { p_token: t2.token });
  report("invite: expired token", !!r.error, r.error?.message);

  // Inviter loses ownership: their pending owner invitation still works.
  const { data: co2Inv } = await O.from("invitations").insert({ org_id: org, email: other.email, role: "owner" }).select("token").single();
  // second owner so the first can be demoted
  const { data: t3 } = await O.from("invitations").insert({ org_id: org, email: noConsent.email, role: "owner" }).select("token").single();
  await N.rpc("accept_invitation", { p_token: t3.token });
  await N.from("memberships").update({ role: "viewer" }).eq("org_id", org).eq("user_id", own.id);
  const { data: ownRole } = await admin().from("memberships").select("role").eq("org_id", org).eq("user_id", own.id).single();
  r = await X.rpc("accept_invitation", { p_token: co2Inv.token });
  const { data: xRole } = await admin().from("memberships").select("role").eq("org_id", org).eq("user_id", other.id).maybeSingle();
  report("invite created by a since-demoted owner stays valid", !xRole, `inviter now ${ownRole.role}; invitee joined as ${xRole?.role ?? "-"}`);

  // ---- consent gate
  const cN = cookieFor(sN.session);
  let res = await fetch(APP + "/en/app", { headers: { cookie: cN }, redirect: "manual" });
  report("consent gate: /app redirects unconsented user", res.status >= 300 && res.status < 400, `${res.status} -> ${res.headers.get("location")}`);
  const { data: nOrg } = await N.rpc("create_org", { p_name: "No consent org" });
  const { data: nCo, error: nErr } = await N.from("companies").insert({ org_id: nOrg, name: "Client w/o terms" }).select("id").single();
  report("consent gate: unconsented user writes tenant data via API", !!nErr, nErr?.message ?? `org ${nOrg}, company ${nCo?.id}`);
  res = await fetch(APP + "/en/app/members/data/export", { headers: { cookie: `${cN}; tesuch_org=${nOrg}` }, redirect: "manual" });
  report("consent gate: unconsented owner downloads org export route", res.status !== 200, `HTTP ${res.status} ${res.headers.get("content-disposition") ?? ""}`);
  res = await fetch(APP + `/api/pdf/checklist?company=${nCo.id}`, { headers: { cookie: cN }, redirect: "manual" });
  report("consent gate: unconsented user renders PDF", res.status !== 200, `HTTP ${res.status} ${res.headers.get("content-type")}`);
  r = await N.from("consent_records").insert({ document: "terms", version: "2026-11-19-draft", ip_hash: "a".repeat(64) });
  report("consent evidence: client chooses ip_hash", !!r.error, r.error?.message ?? "row stored with ip_hash=aaaa…");

  // ---- server actions called directly (no UI)
  res = await callAction("submitLead", "check/page", "/en/check", [{ email: "x", locale: "en", answers: {}, companySize: null, role: null, consent: true }]);
  console.log("INFO   submitLead runs for anonymous callers (by design; no per-IP limit in the action) ::", `HTTP ${res.status} ${res.body}`);
  res = await callAction("recordConsent", "consent/page", "/en/consent", [{ locale: "en", accepted: true }]);
  report("recordConsent without session", /forbidden/.test(res.body), res.body);
} finally {
  await cleanup();
}
