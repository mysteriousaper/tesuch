import "server-only";
import { headers } from "next/headers";
import { currentOrg } from "@/components/dashboard/queries";
import { supabaseForUser, supabaseService } from "@/lib/supabase/server";

type UserClient = Awaited<ReturnType<typeof supabaseForUser>>;

/** Signed-in user, their RLS client and the org they are working in (validated against memberships). */
export async function orgSession() {
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  const org = user ? await currentOrg(supabase, user.id) : null;
  return { supabase, user, org };
}

/**
 * Emails for user ids the caller already saw through RLS (members of their org, audit actors).
 * The auth admin API is only asked about those ids, never listed.
 */
export async function emailsFor(ids: string[]): Promise<Map<string, string>> {
  const admin = supabaseService();
  const unique = [...new Set(ids)].slice(0, 100);
  const pairs = await Promise.all(
    unique.map(async (id) => [id, (await admin.auth.admin.getUserById(id)).data.user?.email ?? null] as const),
  );
  return new Map(pairs.filter((p): p is readonly [string, string] => Boolean(p[1])));
}

const EMPLOYEE_COLS = "id, company_id, full_name, birth_date, six_day_week, external_ref, archived_at, created_at";
const CONTRACT_COLS = "id, employee_id, type, start_date, end_date, probation_end, probation_special_case, hired_by_transfer, fixed_term_ground, src_registered, terminated_on, termination_ground, termination_initiator, notice_given_on, workforce_reduction, termination_ground_code, created_at";
const LEAVE_COLS = "id, employee_id, type, start_date, days, created_at";
const FINDING_COLS = "id, company_id, employee_id, contract_id, rule_id, rule_version, severity, due_date, status, first_seen_at, last_seen_at, resolved_at";

/** Everything stored about one employee, read through RLS (null when the caller cannot see them). */
export async function employeeExport(supabase: UserClient, employeeId: string) {
  const { data: employee } = await supabase.from("employees").select(`${EMPLOYEE_COLS}, companies(name)`).eq("id", employeeId).maybeSingle();
  if (!employee) return null;
  const [contracts, leave, findings] = await Promise.all([
    supabase.from("contracts").select(CONTRACT_COLS).eq("employee_id", employeeId).order("start_date"),
    supabase.from("leave_records").select(LEAVE_COLS).eq("employee_id", employeeId).order("start_date"),
    supabase.from("findings").select(FINDING_COLS).eq("employee_id", employeeId).order("due_date"),
  ]);
  if (contracts.error || leave.error || findings.error) throw new Error("export read failed");
  return { employee, contracts: contracts.data, leave_records: leave.data, findings: findings.data };
}

/** Paged read so large orgs are exported completely (PostgREST caps a single response). */
async function all<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await read(from, from + 999);
    if (error) throw new Error("export read failed");
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** The whole org's tenant data, read through RLS. Members are listed by id and role; emails are added by the caller. */
export async function orgExport(supabase: UserClient, orgId: string) {
  const [org, members, companies, employees, contracts, leave, findings] = await Promise.all([
    supabase.from("orgs").select("id, name, kind, locale, created_at").eq("id", orgId).maybeSingle(),
    all((a, b) => supabase.from("memberships").select("user_id, role, created_at").eq("org_id", orgId).order("created_at").range(a, b)),
    all((a, b) => supabase.from("companies").select("id, name, tax_id, created_at").eq("org_id", orgId).order("created_at").range(a, b)),
    all((a, b) => supabase.from("employees").select(EMPLOYEE_COLS).eq("org_id", orgId).order("id").range(a, b)),
    all((a, b) => supabase.from("contracts").select(CONTRACT_COLS).eq("org_id", orgId).order("id").range(a, b)),
    all((a, b) => supabase.from("leave_records").select(LEAVE_COLS).eq("org_id", orgId).order("id").range(a, b)),
    all((a, b) => supabase.from("findings").select(FINDING_COLS).eq("org_id", orgId).order("id").range(a, b)),
  ]);
  if (!org.data) return null;
  return { org: org.data, members, companies, employees, contracts, leave_records: leave, findings };
}

/** Public base URL for invite links: the configured site URL, else the origin of this request. */
export async function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
