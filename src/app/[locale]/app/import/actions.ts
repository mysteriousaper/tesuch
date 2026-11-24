"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { orgPrivacyMode } from "@/components/dashboard/privacy";
import { dedupeEmployees, type ExistingEmployee } from "@/components/import/dedupe";
import { planResync, type SavedContract, type SavedEmployee } from "@/components/import/resync";
import { MAX_IMPORT_ROWS } from "@/components/import/template";
import { buildImport, TARGET_FIELDS, missingRequiredFields, type ColumnMapping, type TargetField } from "@/lib/import";
import { readAll } from "@/lib/jobs/paging";
import { ensureRules, runRulesForCompany } from "@/lib/jobs/run";
import type { Locale } from "@/lib/notify/i18n";
import { supabaseForUser, supabaseService } from "@/lib/supabase/server";

const MAX_COLUMNS = 60;

// Never trust the client: the raw grid and mapping are re-validated and re-parsed here.
const cell = z.union([z.string().max(2000), z.number(), z.boolean(), z.date(), z.null()]);
const payloadSchema = z.object({
  companyId: z.string().uuid(),
  headers: z.array(z.string().max(300)).min(1).max(MAX_COLUMNS),
  rows: z
    .array(z.object({ rowNumber: z.number().int().positive(), cells: z.array(cell).max(MAX_COLUMNS) }))
    .min(1)
    .max(MAX_IMPORT_ROWS),
  mapping: z.record(z.string().regex(/^\d+$/), z.enum(TARGET_FIELDS).nullable()),
});
export type ImportPayload = z.input<typeof payloadSchema>;

export type CommitResult =
  | {
      ok: true;
      imported: number;
      skippedDuplicates: number;
      /** Re-sync: saved employees whose contract or details were updated from the file. */
      updated: number;
      /** Re-sync: saved employees that already match the file. */
      unchanged: number;
      /** Imported, but share a name with someone and have no employee ID or birth date to tell them apart. */
      possibleDuplicates: string[];
      skippedErrors: number;
      findings: number | null;
      score: number | null;
      companyId: string;
    }
  /** "partial": the import failed AND undoing it failed, so some employees may be saved without contracts. */
  | { ok: false; error: "forbidden" | "invalid" | "nothing" | "failed" | "partial" };

export type PreviewResult =
  | { ok: true; added: number; changed: number; unchanged: number; possibleDuplicates: number }
  | { ok: false; error: "forbidden" | "invalid" | "failed" };

/** Shared by preview and commit: validate, read the company through RLS, parse the file and compare it with saved staff. */
async function prepare(input: ImportPayload) {
  const fail = (error: "forbidden" | "invalid" | "failed") => ({ ok: false as const, error });
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const { companyId, headers, rows } = parsed.data;

  // Mapping: each target field at most once, columns must exist, required fields present.
  const mapping: ColumnMapping = {};
  const used = new Set<TargetField>();
  for (const [col, field] of Object.entries(parsed.data.mapping)) {
    const c = Number(col);
    if (c >= headers.length) return fail("invalid");
    if (field) {
      if (used.has(field)) return fail("invalid");
      used.add(field);
    }
    mapping[c] = field;
  }

  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("forbidden");

  // RLS: the company is only visible to members; org_id comes from the database, not the client.
  const { data: company } = await supabase.from("companies").select("id, org_id, name, orgs(locale)").eq("id", companyId).maybeSingle();
  if (!company) return fail("forbidden");
  const { data: membership } = await supabase
    .from("memberships").select("role").eq("org_id", company.org_id).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "accountant"].includes(membership.role)) return fail("forbidden");

  // Privacy mode is read from the firm's row, never from the client: with it on, names in the file are ignored and never stored.
  const privacy = await orgPrivacyMode(supabase, company.org_id);
  if (missingRequiredFields(mapping, { privacy }).length) return fail("invalid");

  // Codes by default: existing codes are read first so generated ones never collide with them.
  const { data: codeRows } = privacy ? await supabase.from("employees").select("employee_code").eq("company_id", company.id) : { data: [] };
  const existingCodes = ((codeRows ?? []) as { employee_code?: string | null }[]).map((r) => r.employee_code).filter((c): c is string => Boolean(c));
  const result = buildImport({ headers, rows }, mapping, { orgId: company.org_id, companyId: company.id, privacy, existingCodes });
  const skippedErrors = new Set(result.errors.map((e) => e.row)).size;

  // Existing staff, read page by page (a company can have more than 1000 people).
  // Existing codes are read only in privacy mode, so the normal import never touches the new column.
  const cols = privacy ? "id, full_name, birth_date, six_day_week, external_ref, employee_code" : "id, full_name, birth_date, six_day_week, external_ref";
  let existing: (ExistingEmployee & SavedEmployee)[];
  let savedContracts: SavedContract[];
  try {
    existing = (await readAll((from, to) => supabase.from("employees").select(cols).eq("company_id", company.id).order("id").range(from, to))) as unknown as typeof existing;
    // Joined to employees so the filter is one company, not a list of ids (which would overflow the URL).
    savedContracts = (await readAll((from, to) => supabase.from("contracts").select("*, employees!inner(company_id)").eq("employees.company_id", company.id).order("id").range(from, to))) as unknown as SavedContract[];
  } catch {
    return fail("failed");
  }

  // Duplicates: same employee ID, or same name + birth date. A shared name alone is flagged, never dropped.
  // Certain matches are re-synced: changed details and contracts are updated, nothing is wiped.
  const dedupe = dedupeEmployees(result.employees, existing, new Set(result.generatedCodeIds));
  const plan = planResync(dedupe.matched, result.contracts, existing, savedContracts, used);
  const keepIds = new Set(dedupe.keep.map((e) => e.id));
  return {
    ok: true as const, supabase, company, dedupe, plan, skippedErrors,
    employees: dedupe.keep,
    contracts: result.contracts.filter((c) => keepIds.has(c.employee_id)),
  };
}

/** Counts for the preview step: how many rows are new, changed or already up to date. Writes nothing. */
export async function previewImport(input: ImportPayload): Promise<PreviewResult> {
  const p = await prepare(input);
  if (!p.ok) return p;
  return { ok: true, added: p.employees.length, changed: p.plan.changed, unchanged: p.plan.unchanged, possibleDuplicates: p.dedupe.possibleDuplicates.length };
}

export async function commitImport(locale: Locale, input: ImportPayload): Promise<CommitResult> {
  const p = await prepare(input);
  if (!p.ok) return p;
  const { supabase, company, dedupe, plan, employees, contracts, skippedErrors } = p;
  const syncCount = plan.changed;
  if (!employees.length && !syncCount) return { ok: false, error: "nothing" };

  // Insert with the user's client so RLS applies. Each insert is a single statement, so atomic on its own.
  // All-or-nothing across the two: if contracts fail, delete the employees just added (their contracts cascade),
  // and report plainly if even that cleanup fails.
  if (employees.length) {
    const { error: empErr } = await supabase.from("employees").insert(employees);
    if (empErr) return { ok: false, error: "failed" };
    const { error: conErr } = await supabase.from("contracts").insert(contracts);
    if (conErr) {
      const { error: undoErr } = await supabase.from("employees").delete().in("id", employees.map((e) => e.id));
      return { ok: false, error: undoErr ? "partial" : "failed" };
    }
  }

  // Re-sync of people already saved. Updates run after the inserts; the audit trigger records each change.
  try {
    for (const u of plan.employeePatches) {
      const { error } = await supabase.from("employees").update(u.patch).eq("id", u.id).eq("company_id", company.id);
      if (error) throw error;
    }
    for (const u of plan.contractPatches) {
      const { error } = await supabase.from("contracts").update(u.patch).eq("id", u.id);
      if (error) throw error;
    }
    if (plan.contractInserts.length) {
      const { error } = await supabase.from("contracts").insert(plan.contractInserts.map((c) => ({ ...c, org_id: company.org_id })));
      if (error) throw error;
    }
  } catch {
    // New staff are saved; the re-sync stopped part-way. Running the same file again finishes it (updates are idempotent).
    return { ok: false, error: "failed" };
  }

  // Findings are written by the system only: service role, after the authorisation checks above.
  let findings: number | null = null;
  let score: number | null = null;
  try {
    const db = supabaseService();
    await ensureRules(db);
    const orgLocale = (company.orgs as unknown as { locale?: Locale } | null)?.locale ?? locale;
    const run = await runRulesForCompany(
      db, { id: company.id, org_id: company.org_id, name: company.name, locale: orgLocale }, format(new Date(), "yyyy-MM-dd"), { sendAlerts: false },
    );
    findings = run.computed.length;
    score = run.score;
  } catch {
    // Data is saved; the nightly job will evaluate it. The UI says so.
  }

  revalidatePath(`/${locale}/app`);
  return {
    ok: true, imported: employees.length, skippedDuplicates: plan.unchanged, updated: plan.changed, unchanged: plan.unchanged,
    possibleDuplicates: dedupe.possibleDuplicates, skippedErrors, findings, score, companyId: company.id,
  };
}
