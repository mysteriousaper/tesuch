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

/** All throwaway test users share this prefix so teardown can find leftovers from crashed runs. */
export const TEST_EMAIL_PREFIX = "qa-e-";

export interface TestUser {
  id: string;
  email: string;
}

export async function createTestUser(label = "u"): Promise<TestUser> {
  const email = `${TEST_EMAIL_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const { data, error } = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
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

/** Removes every user with the test prefix, including leftovers from interrupted runs. */
export async function deleteAllTestUsers(): Promise<number> {
  const db = admin();
  const ids: string[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    for (const u of data.users) if (u.email?.startsWith(TEST_EMAIL_PREFIX)) ids.push(u.id);
    if (data.users.length < 200) break;
  }
  await deleteTestUsers(ids);
  return ids.length;
}
