// Breaker QA helpers: throwaway users on the real Supabase project, signed-in clients and app cookies.
// Run with: NODE_USE_ENV_PROXY=1 node --env-file=.env.local docs/qa/breaker/<probe>.mjs
// Every user created here has the "qa-e-breaker-" prefix and is deleted by cleanup() (or by the e2e
// global teardown's stale sweep if a run crashes).
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const APP = process.env.APP_URL ?? "http://localhost:3303";
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = () => createClient(URL_, SR, opts);
export const anon = () => createClient(URL_, ANON, opts);

const created = [];
const extraOrgs = [];

export async function createUser(label, { consent = true, email } = {}) {
  email ??= `qa-e-breaker-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { data, error } = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  created.push(data.user.id);
  if (consent) {
    const rows = ["terms", "privacy"].map((document) => ({ user_id: data.user.id, document, version: CURRENT[document] }));
    const { error: e } = await admin().from("consent_records").insert(rows);
    if (e) throw new Error(`consent: ${e.message}`);
  }
  return { id: data.user.id, email };
}

// Legal versions are read from the app so consent rows match the gate.
const CURRENT = {};
{
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../../src/components/legal/versions.ts", import.meta.url), "utf8");
  for (const m of src.matchAll(/(terms|privacy|dpa)\s*:\s*"([^"]+)"/g)) CURRENT[m[1]] ??= m[2];
}

/** Signed-in supabase-js client plus the raw session. */
export async function signIn(user) {
  const { data, error } = await admin().auth.admin.generateLink({ type: "magiclink", email: user.email });
  if (error) throw new Error(`generateLink: ${error.message}`);
  const c = anon();
  const { data: s, error: e2 } = await c.auth.verifyOtp({ email: user.email, token: data.properties.email_otp, type: "email" });
  if (e2) throw new Error(`verifyOtp: ${e2.message}`);
  return { client: c, session: s.session };
}

/** Cookie header the Next.js app (@supabase/ssr) accepts for this session. */
export function cookieFor(session, extra = "") {
  const ref = new URL(URL_).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const parts = [];
  const CHUNK = 3180;
  if (value.length <= CHUNK) parts.push(`${name}=${value}`);
  else for (let i = 0; i * CHUNK < value.length; i++) parts.push(`${name}.${i}=${value.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  return [...parts, extra].filter(Boolean).join("; ");
}

export function trackOrg(id) {
  extraOrgs.push(id);
}

export async function cleanup() {
  const db = admin();
  const { data: owned } = await db.from("memberships").select("org_id").in("user_id", created);
  const orgIds = [...new Set([...(owned ?? []).map((m) => m.org_id), ...extraOrgs])];
  if (orgIds.length) {
    await db.from("audit_log").delete().in("org_id", orgIds);
    await db.from("orgs").delete().in("id", orgIds);
  }
  for (const id of created) await db.auth.admin.deleteUser(id);
  console.log(`cleanup: ${orgIds.length} orgs, ${created.length} users deleted`);
}

export function report(name, ok, detail = "") {
  console.log(`${ok ? "HELD " : "BROKE"}  ${name}${detail ? `  :: ${detail}` : ""}`);
}
