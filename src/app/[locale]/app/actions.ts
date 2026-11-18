"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureRules, runRulesForCompany } from "@/lib/jobs/run";
import type { Locale } from "@/lib/notify/i18n";
import { supabaseForUser, supabaseService } from "@/lib/supabase/server";
import { generateDemoCompanies } from "./demo-data";

/** Result shape for forms using useActionState. `error` is a key in dashboard.errors. */
export type ActionState = { ok: true; count?: number } | { ok: false; error: "generic" | "invalid" | "forbidden" } | null;

const FAIL = (error: "generic" | "invalid" | "forbidden"): ActionState => ({ ok: false, error });
const today = () => format(new Date(), "yyyy-MM-dd");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optDate = z.preprocess((v) => (v === "" || v == null ? null : v), isoDate.nullable());
const optText = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(300).nullable());
const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());
const uuid = z.string().uuid();

async function session() {
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

type UserClient = Awaited<ReturnType<typeof supabaseForUser>>;

async function canEdit(supabase: UserClient, userId: string, orgId: string): Promise<boolean> {
  const { data } = await supabase.from("memberships").select("role").eq("user_id", userId).eq("org_id", orgId).maybeSingle();
  return data?.role === "owner" || data?.role === "accountant";
}

/** The company as the user sees it (RLS), plus whether they may edit it. org_id always comes from here, never from the client. */
async function editableCompany(supabase: UserClient, userId: string, companyId: string) {
  const { data: co } = await supabase.from("companies").select("id, org_id, name, orgs(locale)").eq("id", companyId).maybeSingle();
  if (!co || !(await canEdit(supabase, userId, co.org_id))) return null;
  const locale = ((co.orgs as unknown as { locale?: string } | null)?.locale ?? "hy") as Locale;
  return { id: co.id as string, org_id: co.org_id as string, name: co.name as string, locale };
}

/** The first org the user can edit. */
async function editableOrg(supabase: UserClient, userId: string) {
  const { data } = await supabase
    .from("memberships").select("org_id, role, created_at").eq("user_id", userId).in("role", ["owner", "accountant"])
    .order("created_at").limit(1).maybeSingle();
  return data?.org_id as string | undefined;
}

/** Rules run with the service role (findings are system-written) — only after the user's right to edit was checked. */
async function recheck(co: { id: string; org_id: string; name: string; locale: Locale }) {
  const db = supabaseService();
  await ensureRules(db);
  return runRulesForCompany(db, co, today(), { sendAlerts: false });
}

export async function createOrg(locale: string, form: FormData) {
  const name = z.string().trim().min(1).max(200).parse(form.get("name"));
  const supabase = await supabaseForUser();
  const { error } = await supabase.rpc("create_org", { p_name: name });
  if (error) throw new Error(error.message);
  revalidatePath(`/${locale}/app`);
}

export async function signOut() {
  const supabase = await supabaseForUser();
  await supabase.auth.signOut();
}

export async function addCompany(locale: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z.object({
    name: z.string().trim().min(1).max(200),
    tax_id: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{8}$/).nullable()),
  }).safeParse({ name: form.get("name"), tax_id: form.get("tax_id") ?? "" });
  if (!parsed.success) return FAIL("invalid");
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  const orgId = await editableOrg(supabase, user.id);
  if (!orgId) return FAIL("forbidden");
  const { error } = await supabase.from("companies").insert({ org_id: orgId, ...parsed.data });
  if (error) return FAIL("generic");
  revalidatePath(`/${locale}/app`);
  return { ok: true };
}

export async function loadDemoData(locale: string): Promise<ActionState> {
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  const orgId = await editableOrg(supabase, user.id);
  if (!orgId) return FAIL("forbidden");
  const { data: org } = await supabase.from("orgs").select("locale").eq("id", orgId).single();
  const demo = generateDemoCompanies(today(), Date.now());

  try {
    for (const c of demo) {
      // Inserts go through the user's client, so RLS decides what is allowed.
      const { data: co, error } = await supabase.from("companies").insert({ org_id: orgId, name: c.name }).select("id").single();
      if (error) throw error;
      for (const e of c.employees) {
        const { data: emp, error: ee } = await supabase.from("employees")
          .insert({ org_id: orgId, company_id: co.id, full_name: e.fullName, birth_date: e.birthDate, six_day_week: e.sixDayWeek })
          .select("id").single();
        if (ee) throw ee;
        const { error: ce } = await supabase.from("contracts").insert({ org_id: orgId, employee_id: emp.id, ...e.contract });
        if (ce) throw ce;
        if (e.leave.length) {
          const { error: le } = await supabase.from("leave_records").insert(e.leave.map((l) => ({ org_id: orgId, employee_id: emp.id, ...l })));
          if (le) throw le;
        }
      }
      await recheck({ id: co.id, org_id: orgId, name: c.name, locale: (org?.locale ?? "hy") as Locale });
    }
  } catch {
    return FAIL("generic");
  }
  revalidatePath(`/${locale}/app`);
  return { ok: true };
}

export async function recheckCompany(locale: string, companyId: string): Promise<ActionState> {
  if (!uuid.safeParse(companyId).success) return FAIL("invalid");
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  const co = await editableCompany(supabase, user.id, companyId);
  if (!co) return FAIL("forbidden");
  try {
    const r = await recheck(co);
    revalidatePath(`/${locale}/app`);
    revalidatePath(`/${locale}/app/companies/${companyId}`);
    return { ok: true, count: r.computed.length };
  } catch {
    return FAIL("generic");
  }
}

export async function setFindingStatus(locale: string, companyId: string, findingId: string, status: "open" | "fixed" | "dismissed") {
  if (!uuid.safeParse(findingId).success || !["open", "fixed", "dismissed"].includes(status)) return;
  const { supabase, user } = await session();
  if (!user) return;
  // RLS (can_edit) and the findings trigger (status-only) enforce the rest.
  await supabase.from("findings").update({ status }).eq("id", findingId).eq("company_id", companyId);
  revalidatePath(`/${locale}/app/companies/${companyId}`);
  revalidatePath(`/${locale}/app`);
}

const employeeSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  birth_date: optDate,
  six_day_week: checkbox,
  type: z.enum(["indefinite", "fixed_term"]),
  start_date: isoDate,
  end_date: optDate,
  probation_end: optDate,
  probation_special_case: checkbox,
  hired_by_transfer: checkbox,
  fixed_term_ground: optText,
  src_registered: checkbox,
}).refine((v) => v.type === "fixed_term" || v.end_date === null, { path: ["end_date"] })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, { path: ["end_date"] })
  .refine((v) => !v.probation_end || v.probation_end >= v.start_date, { path: ["probation_end"] });

export async function addEmployee(locale: string, companyId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = employeeSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success || !uuid.safeParse(companyId).success) return FAIL("invalid");
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  const co = await editableCompany(supabase, user.id, companyId);
  if (!co) return FAIL("forbidden");
  const { full_name, birth_date, six_day_week, ...contract } = parsed.data;
  const { data: emp, error } = await supabase.from("employees")
    .insert({ org_id: co.org_id, company_id: co.id, full_name, birth_date, six_day_week }).select("id").single();
  if (error) return FAIL("generic");
  const { error: ce } = await supabase.from("contracts").insert({ org_id: co.org_id, employee_id: emp.id, ...contract });
  if (ce) return FAIL("generic");
  try {
    await recheck(co);
  } catch {
    // Saved; findings will be refreshed tonight.
  }
  revalidatePath(`/${locale}/app/companies/${companyId}`);
  return { ok: true };
}

const leaveSchema = z.object({
  type: z.enum(["annual", "maternity", "cash_compensation", "other"]),
  start_date: isoDate,
  days: z.coerce.number().int().min(1).max(400),
});

export async function addLeave(locale: string, companyId: string, employeeId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = leaveSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success || !uuid.safeParse(companyId).success || !uuid.safeParse(employeeId).success) return FAIL("invalid");
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  const co = await editableCompany(supabase, user.id, companyId);
  if (!co) return FAIL("forbidden");
  const { data: emp } = await supabase.from("employees").select("id").eq("id", employeeId).eq("company_id", co.id).maybeSingle();
  if (!emp) return FAIL("forbidden");
  const { error } = await supabase.from("leave_records").insert({ org_id: co.org_id, employee_id: emp.id, ...parsed.data });
  if (error) return FAIL("generic");
  try {
    await recheck(co);
  } catch {
    // Saved; findings will be refreshed tonight.
  }
  revalidatePath(`/${locale}/app/companies/${companyId}/employees/${employeeId}`);
  return { ok: true };
}

export async function renameOrg(locale: string, orgId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const name = z.string().trim().min(1).max(200).safeParse(form.get("name"));
  if (!name.success || !uuid.safeParse(orgId).success) return FAIL("invalid");
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  // RLS: only owners can update orgs; a non-owner update affects 0 rows.
  const { data, error } = await supabase.from("orgs").update({ name: name.data }).eq("id", orgId).select("id");
  if (error) return FAIL("generic");
  if (!data?.length) return FAIL("forbidden");
  revalidatePath(`/${locale}/app/settings`);
  return { ok: true };
}
