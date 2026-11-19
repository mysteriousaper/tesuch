import { GATE_DOCUMENTS, LEGAL_VERSIONS } from "../../../src/components/legal/versions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

/** Service-role client: bypasses RLS. Test setup/teardown only. */
export function admin(): SupabaseClient {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), opts);
}

/** Anonymous client (publishable key), as an unauthenticated browser would be. */
export function anon(): SupabaseClient {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), opts);
}

/** All throwaway test users share this prefix so leftovers from crashed runs can be found. */
export const TEST_EMAIL_PREFIX = "qa-e-";
/**
 * Per-run id (set once in playwright.config.ts and inherited by workers), so parallel runs from
 * different worktrees never delete each other's users.
 */
export const RUN_PREFIX = `${TEST_EMAIL_PREFIX}${process.env.E2E_RUN_ID ?? "local"}-`;

export interface TestUser {
  id: string;
  email: string;
}

/**
 * Creates a throwaway user. By default the user has already accepted the current terms + privacy,
 * so specs land in /app instead of the consent gate; pass { consent: false } to test the gate itself.
 */
export async function createTestUser(label = "u", opts: { consent?: boolean } = {}): Promise<TestUser> {
  const email = `${RUN_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const { data, error } = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  if (opts.consent !== false) {
    const rows = GATE_DOCUMENTS.map((document) => ({ user_id: data.user!.id, document, version: LEGAL_VERSIONS[document] }));
    const { error: cErr } = await admin().from("consent_records").insert(rows);
    if (cErr) throw new Error(`consent insert failed: ${cErr.message}`);
  }
  return { id: data.user.id, email };
}

/** One-time email code for a user, exactly what the real sign-in email would contain. */
export async function emailOtp(email: string): Promise<string> {
  const { data, error } = await admin().auth.admin.generateLink({ type: "magiclink", email });
  const otp = data?.properties?.email_otp;
  if (error || !otp) throw new Error(`generateLink failed: ${error?.message}`);
  return otp;
}

/** A supabase-js client signed in as `user` (RLS applies), without going through the UI. */
export async function clientAs(user: TestUser): Promise<SupabaseClient> {
  const c = anon();
  const { error } = await c.auth.verifyOtp({ email: user.email, token: await emailOtp(user.email), type: "email" });
  if (error) throw new Error(`verifyOtp failed: ${error.message}`);
  return c;
}

/** Deletes orgs owned by the given users (cascades to all tenant data), then the users. */
export async function deleteTestUsers(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = admin();
  const { data: owned } = await db.from("memberships").select("org_id").in("user_id", ids).eq("role", "owner");
  const orgIds = [...new Set((owned ?? []).map((m) => m.org_id as string))];
  if (orgIds.length) {
    // audit_log has no FK to orgs; clear test rows so they don't accumulate.
    await db.from("audit_log").delete().in("org_id", orgIds);
    await db.from("orgs").delete().in("id", orgIds);
  }
  for (const id of ids) await db.auth.admin.deleteUser(id);
}

/**
 * Removes this run's users, plus leftovers from crashed runs older than `staleMinutes`.
 * Never touches another run's recent users, so concurrent suites are safe.
 */
export async function deleteAllTestUsers(staleMinutes = 120): Promise<number> {
  const cutoff = Date.now() - staleMinutes * 60_000;
  const db = admin();
  const ids: string[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      const email = u.email ?? "";
      const mine = email.startsWith(RUN_PREFIX);
      const stale = email.startsWith(TEST_EMAIL_PREFIX) && new Date(u.created_at).getTime() < cutoff;
      if (mine || stale) ids.push(u.id);
    }
    if (data.users.length < 200) break;
  }
  await deleteTestUsers(ids);
  return ids.length;
}
