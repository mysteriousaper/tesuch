import type { supabaseForUser } from "@/lib/supabase/server";

type UserClient = Awaited<ReturnType<typeof supabaseForUser>>;

/**
 * Whether a firm runs in privacy mode ("code instead of name"). Read through the user's RLS client.
 * Defensive: if the column is not there yet (migration not applied) or the read fails, it is "off",
 * so pages that merely read never break.
 */
export async function orgPrivacyMode(supabase: UserClient, orgId: string): Promise<boolean> {
  const { data, error } = await supabase.from("orgs").select("privacy_mode").eq("id", orgId).maybeSingle();
  return !error && (data as { privacy_mode?: boolean } | null)?.privacy_mode === true;
}

/** Org ids (among those the user can see) that are in privacy mode. Same defensive behaviour. */
export async function privacyOrgIds(supabase: UserClient): Promise<Set<string>> {
  const { data, error } = await supabase.from("orgs").select("id").eq("privacy_mode", true);
  return new Set(error ? [] : (data ?? []).map((o) => o.id as string));
}

/** employee_code of one employee (privacy mode forms only). Empty when unset or the column is not there yet. */
export async function employeeCodeOf(supabase: UserClient, employeeId: string): Promise<string> {
  const { data, error } = await supabase.from("employees").select("employee_code").eq("id", employeeId).maybeSingle();
  return error ? "" : ((data as { employee_code?: string | null } | null)?.employee_code ?? "");
}

/** True while an owner of a firm that still stores names has not answered the "switch to codes" notice. Defensive like the reads above. */
export async function codesNoticePending(supabase: UserClient, orgId: string): Promise<boolean> {
  const { data, error } = await supabase.from("orgs").select("privacy_mode, codes_notice_dismissed").eq("id", orgId).maybeSingle();
  if (error || !data) return false;
  const row = data as { privacy_mode?: boolean; codes_notice_dismissed?: boolean };
  return row.privacy_mode === false && row.codes_notice_dismissed === false;
}
