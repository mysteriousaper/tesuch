"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { currentOrg, ORG_COOKIE, userOrgs } from "@/components/dashboard/queries";
import { orgPrivacyMode } from "@/components/dashboard/privacy";
import { ensureRules, runRulesForCompany } from "@/lib/jobs/run";
import type { Locale } from "@/lib/notify/i18n";
import { redirect } from "@/i18n/navigation";
import { supabaseForUser, supabaseService } from "@/lib/supabase/server";
import {
  applyPrivacyIdentity, bulkFindingSchema, canEditRole, dismissReasonSchema, companySchema, confirmsCompanyName, isOwnerRole, editSchema, employeeSchema, FAIL, findingStatusSchema, insertDemo, insertEmployeeWithContract,
  leaveSchema, splitEmployee, uuid, type ActionState,
} from "./dashboard-logic";
import { generateDemoCompanies } from "./demo-data";

// Thin server actions: validation, rollback and permission rules live in ./dashboard-logic (unit-tested).
export type { ActionState };

const today = () => format(new Date(), "yyyy-MM-dd");

async function session() {
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

type UserClient = Awaited<ReturnType<typeof supabaseForUser>>;

async function canEdit(supabase: UserClient, userId: string, orgId: string): Promise<boolean> {
  const { data } = await supabase.from("memberships").select("role").eq("user_id", userId).eq("org_id", orgId).maybeSingle();
  return canEditRole(data?.role);
}

/** The company as the user sees it (RLS), plus whether they may edit it. org_id always comes from here, never from the client. */
async function editableCompany(supabase: UserClient, userId: string, companyId: string) {
  const { data: co } = await supabase.from("companies").select("id, org_id, name, orgs(locale)").eq("id", companyId).maybeSingle();
  if (!co || !(await canEdit(supabase, userId, co.org_id))) return null;
  const locale = ((co.orgs as unknown as { locale?: string } | null)?.locale ?? "hy") as Locale;
  return { id: co.id as string, org_id: co.org_id as string, name: co.name as string, locale };
}

/** The org the user is working in, if they may edit it. Never falls back to another org silently. */
async function editableOrg(supabase: UserClient, userId: string) {
  const org = await currentOrg(supabase, userId);
  return org && canEditRole(org.role) ? { id: org.id, locale: org.locale as Locale } : undefined;
}

async function rememberOrg(orgId: string) {
  (await cookies()).set(ORG_COOKIE, orgId, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
}

/** Rules run with the service role (findings are system-written) — only after the user's right to edit was checked. */
async function recheck(co: { id: string; org_id: string; name: string; locale: Locale }) {
  const db = supabaseService();
  await ensureRules(db);
  return runRulesForCompany(db, co, today(), { sendAlerts: false });
}

/** Re-run rules after a data change. The change is already saved; if this fails the nightly run catches up. */
async function recheckQuietly(co: Parameters<typeof recheck>[0]) {
  try {
    await recheck(co);
  } catch {
    // Saved; findings will be refreshed tonight.
  }
}

/** Throws the Supabase error so multi-step writers can roll back. */
function must(r: { data: unknown; error: unknown }): { id: string } {
  if (r.error || r.data == null) throw r.error ?? new Error("no data");
  return r.data as { id: string };
}

export async function createOrg(locale: string, form: FormData) {
  const name = z.string().trim().min(1).max(200).parse(form.get("name"));
  const supabase = await supabaseForUser();
  const { data, error } = await supabase.rpc("create_org", { p_name: name });
  if (error) throw new Error(error.message);
  await rememberOrg(data as string);
  // A new business starts with its company already created from the name, so the owner never meets the word "company" first.
  // Best effort: if this fails the firm still exists and the dashboard offers "Add company".
  await supabase.from("companies").insert({ org_id: data as string, name });
  revalidatePath(`/${locale}/app`, "layout");
}

/** Switch the active org. The cookie is only set for an org the user is a member of. */
export async function switchOrg(locale: string, form: FormData) {
  const orgId = uuid.safeParse(form.get("org_id"));
  if (!orgId.success) return;
  const { supabase, user } = await session();
  if (!user) return;
  if (!(await userOrgs(supabase, user.id)).some((o) => o.id === orgId.data)) return;
  await rememberOrg(orgId.data);
  revalidatePath(`/${locale}/app`, "layout");
}

export async function signOut() {
  const supabase = await supabaseForUser();
  await supabase.auth.signOut();
}

export async function addCompany(locale: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = companySchema.safeParse({ name: form.get("name"), tax_id: form.get("tax_id") });
  if (!parsed.success) return FAIL("invalid");
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  const org = await editableOrg(supabase, user.id);
  if (!org) return FAIL("forbidden");
  const { error } = await supabase.from("companies").insert({ org_id: org.id, ...parsed.data });
  if (error) return FAIL("generic");
  revalidatePath(`/${locale}/app`);
  return { ok: true };
}

export async function loadDemoData(locale: string): Promise<ActionState> {
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  const org = await editableOrg(supabase, user.id);
  if (!org) return FAIL("forbidden");
  // One set of demo companies per firm. insertDemo is all-or-nothing, so presence means a complete set.
  const { count } = await supabase.from("companies").select("id", { count: "exact", head: true }).eq("org_id", org.id).like("name", "Դեմո % ՍՊԸ");
  if (count) return { ok: true, info: "demoExists" };

  const demo = generateDemoCompanies(today(), Date.now());
  // Writes go through the user's client, so RLS decides what is allowed.
  const result = await insertDemo({
    insertCompany: async (name) => must(await supabase.from("companies").insert({ org_id: org.id, name }).select("id").single()).id,
    insertEmployees: async (companyId, rows) => {
      const { error } = await supabase.from("employees").insert(rows.map(({ id, e }) => (
        { id, org_id: org.id, company_id: companyId, full_name: e.fullName, birth_date: e.birthDate, six_day_week: e.sixDayWeek }
      )));
      if (error) throw error;
    },
    insertContracts: async (rows) => {
      const { error } = await supabase.from("contracts").insert(rows.map(({ employeeId, c }) => ({ org_id: org.id, employee_id: employeeId, ...c })));
      if (error) throw error;
    },
    insertLeave: async (rows) => {
      const { error } = await supabase.from("leave_records").insert(rows.map(({ employeeId, l }) => ({ org_id: org.id, employee_id: employeeId, ...l })));
      if (error) throw error;
    },
    deleteCompanies: async (ids) => {
      // Delete is owner-only under RLS, so an accountant's rollback runs with the service role. The role was checked above
      // (editableOrg) and the delete is pinned to this org and to the ids just created here.
      await supabaseService().from("companies").delete().eq("org_id", org.id).in("id", ids);
    },
  }, demo);
  if (!result.ok) return FAIL("generic");

  for (const [i, id] of result.companyIds.entries()) {
    await recheckQuietly({ id, org_id: org.id, name: demo[i].name, locale: org.locale });
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

/**
 * Fix / dismiss / reopen. RLS (can_edit) and the findings trigger (status, assignee and dismissed_reason only) enforce the rest;
 * 0 rows = refused. Dismissing needs a written reason (checked here and again by the trigger).
 */
export async function setFindingStatus(
  locale: string, companyId: string, findingId: string, status: "open" | "fixed" | "dismissed", _prev?: ActionState, form?: FormData,
): Promise<ActionState> {
  const parsed = findingStatusSchema.safeParse({ companyId, findingId, status });
  if (!parsed.success) return FAIL("invalid");
  let reason: string | null = null;
  if (parsed.data.status === "dismissed") {
    const r = dismissReasonSchema.safeParse(form?.get("reason") ?? "");
    if (!r.success) return FAIL("reasonRequired");
    reason = r.data;
  }
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  const { data, error } = await supabase.from("findings")
    .update({ status: parsed.data.status, ...(reason ? { dismissed_reason: reason } : {}) })
    .eq("id", parsed.data.findingId).eq("company_id", parsed.data.companyId).select("id");
  if (error) return FAIL("generic");
  if (!data?.length) return FAIL("forbidden");
  revalidatePath(`/${locale}/app/companies/${companyId}`);
  revalidatePath(`/${locale}/app`);
  return { ok: true };
}

/** Fix or dismiss many open findings of one company at once (checkboxes on the company page). Same checks as the single action. */
export async function bulkSetFindingStatus(locale: string, companyId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  // `status` comes from the clicked button (name="status"); the schema only accepts "fixed" or "dismissed".
  const parsed = bulkFindingSchema.safeParse({ companyId, ids: form.getAll("ids").map(String), status: form.get("status")?.toString(), reason: form.get("reason")?.toString() });
  if (!parsed.success) {
    return FAIL(parsed.error.issues.some((i) => i.path[0] === "reason") ? "reasonRequired" : parsed.error.issues.some((i) => i.path[0] === "ids") ? "nothingSelected" : "invalid");
  }
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  const { data, error } = await supabase.from("findings")
    .update({ status: parsed.data.status, ...(parsed.data.reason ? { dismissed_reason: parsed.data.reason } : {}) })
    .in("id", parsed.data.ids).eq("company_id", parsed.data.companyId).eq("status", "open").select("id");
  if (error) return FAIL("generic");
  if (!data?.length) return FAIL("forbidden");
  revalidatePath(`/${locale}/app/companies/${companyId}`);
  revalidatePath(`/${locale}/app`);
  return { ok: true, count: data.length };
}

export async function addEmployee(locale: string, companyId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  if (!uuid.safeParse(companyId).success) return FAIL("invalid");
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  const co = await editableCompany(supabase, user.id, companyId);
  if (!co) return FAIL("forbidden");
  // Privacy mode comes from the firm's row, never from the form: with it on, the code replaces the name.
  const identity = applyPrivacyIdentity(Object.fromEntries(form), await orgPrivacyMode(supabase, co.org_id), { generate: true });
  if (!identity.ok) return FAIL("invalid");
  const parsed = employeeSchema.safeParse(identity.raw);
  if (!parsed.success) return FAIL("invalid");

  const { employee, contract } = splitEmployee(parsed.data, identity.code);
  const result = await insertEmployeeWithContract({
    insertEmployee: async (row) => must(await supabase.from("employees").insert({ org_id: co.org_id, company_id: co.id, ...row }).select("id").single()).id,
    insertContract: async (employeeId, row) => {
      const { error } = await supabase.from("contracts").insert({ org_id: co.org_id, employee_id: employeeId, ...row });
      if (error) throw error;
    },
    deleteEmployee: async (employeeId) => {
      await supabase.from("employees").delete().eq("id", employeeId).eq("company_id", co.id);
    },
  }, employee, contract);
  if (!result.ok) return FAIL(result.duplicateCode ? "duplicateCode" : "generic");

  await recheckQuietly(co);
  revalidatePath(`/${locale}/app/companies/${companyId}`);
  return { ok: true };
}

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
  await recheckQuietly(co);
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

/** Edit an employee and their contract, then re-run the rules so fixed data closes its findings. */
export async function updateEmployee(
  locale: string, companyId: string, employeeId: string, contractId: string, _prev: ActionState, form: FormData,
): Promise<ActionState> {
  if (![companyId, employeeId, contractId].every((id) => uuid.safeParse(id).success)) return FAIL("invalid");
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  const co = await editableCompany(supabase, user.id, companyId);
  if (!co) return FAIL("forbidden");
  const identity = applyPrivacyIdentity(Object.fromEntries(form), await orgPrivacyMode(supabase, co.org_id));
  if (!identity.ok) return FAIL("invalid");
  const parsed = editSchema.safeParse(identity.raw);
  if (!parsed.success) return FAIL("invalid");

  // Ids are only used as filters: an employee must belong to this company and the contract to this employee.
  const { employee, contract } = splitEmployee(parsed.data, identity.code);
  const { data: emp, error } = await supabase.from("employees").update(employee).eq("id", employeeId).eq("company_id", co.id).select("id");
  if (error) return FAIL(error.code === "23505" ? "duplicateCode" : "generic");
  if (!emp?.length) return FAIL("forbidden");
  const { data: con, error: ce } = await supabase.from("contracts").update(contract).eq("id", contractId).eq("employee_id", employeeId).select("id");
  if (ce) return FAIL("generic");
  if (!con?.length) return FAIL("forbidden");
  await recheckQuietly(co);
  revalidatePath(`/${locale}/app/companies/${companyId}`, "layout");
  return { ok: true };
}

/** The company as the user sees it (RLS), only when they are an owner of its org. org_id comes from the row, never the client. */
async function ownedCompany(supabase: UserClient, userId: string, companyId: string) {
  const { data: co } = await supabase.from("companies").select("id, org_id, name").eq("id", companyId).maybeSingle();
  if (!co) return null;
  const { data: m } = await supabase.from("memberships").select("role").eq("user_id", userId).eq("org_id", co.org_id).maybeSingle();
  return isOwnerRole(m?.role) ? { id: co.id as string, org_id: co.org_id as string, name: co.name as string } : null;
}

/** Owner-only rename / tax id change. Plain RLS client; the companies_update policy is owner-only as well. */
export async function updateCompany(locale: string, companyId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = companySchema.safeParse({ name: form.get("name"), tax_id: form.get("tax_id") });
  if (!parsed.success || !uuid.safeParse(companyId).success) return FAIL("invalid");
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  const co = await ownedCompany(supabase, user.id, companyId);
  if (!co) return FAIL("forbidden");
  const { data, error } = await supabase.from("companies").update(parsed.data).eq("id", co.id).eq("org_id", co.org_id).select("id");
  if (error) return FAIL("generic");
  if (!data?.length) return FAIL("forbidden");
  revalidatePath(`/${locale}/app`);
  revalidatePath(`/${locale}/app/companies/${companyId}`);
  return { ok: true };
}

/** Owner-only delete, confirmed by typing the company name. Employees, contracts, leave and findings cascade; audit rows stay. */
export async function deleteCompany(locale: string, companyId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  if (!uuid.safeParse(companyId).success) return FAIL("invalid");
  const { supabase, user } = await session();
  if (!user) return FAIL("forbidden");
  const co = await ownedCompany(supabase, user.id, companyId);
  if (!co) return FAIL("forbidden");
  if (!confirmsCompanyName(co.name, form.get("confirm"))) return FAIL("invalid");
  const { data, error } = await supabase.from("companies").delete().eq("id", co.id).eq("org_id", co.org_id).select("id");
  if (error) return FAIL("generic");
  if (!data?.length) return FAIL("forbidden");
  revalidatePath(`/${locale}/app`);
  return redirect({ href: "/app", locale });
}
