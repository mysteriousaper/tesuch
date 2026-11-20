"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { orgPrivacyMode } from "@/components/dashboard/privacy";
import { dedupeEmployees, type ExistingEmployee } from "@/components/import/dedupe";
import { MAX_IMPORT_ROWS } from "@/components/import/template";
import { buildImport, TARGET_FIELDS, missingRequiredFields, type ColumnMapping } from "@/lib/import";
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
      /** Imported, but share a name with someone and have no employee ID or birth date to tell them apart. */
      possibleDuplicates: string[];
      skippedErrors: number;
      findings: number | null;
      score: number | null;
      companyId: string;
    }
  /** "partial": the import failed AND undoing it failed, so some employees may be saved without contracts. */
  | { ok: false; error: "forbidden" | "invalid" | "nothing" | "failed" | "partial" };

export async function commitImport(locale: Locale, input: ImportPayload): Promise<CommitResult> {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { companyId, headers, rows } = parsed.data;

  // Mapping: each target field at most once, columns must exist, required fields present.
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const [col, field] of Object.entries(parsed.data.mapping)) {
    const c = Number(col);
    if (c >= headers.length) return { ok: false, error: "invalid" };
    if (field) {
      if (used.has(field)) return { ok: false, error: "invalid" };
      used.add(field);
    }
    mapping[c] = field;
  }

  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "forbidden" };

  // RLS: the company is only visible to members; org_id comes from the database, not the client.
  const { data: company } = await supabase.from("companies").select("id, org_id, name, orgs(locale)").eq("id", companyId).maybeSingle();
  if (!company) return { ok: false, error: "forbidden" };
  const { data: membership } = await supabase
    .from("memberships").select("role").eq("org_id", company.org_id).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "accountant"].includes(membership.role)) return { ok: false, error: "forbidden" };

  // Privacy mode is read from the firm's row, never from the client: with it on, names in the file are ignored and never stored.
  const privacy = await orgPrivacyMode(supabase, company.org_id);
  if (missingRequiredFields(mapping, { privacy }).length) return { ok: false, error: "invalid" };

  // Codes by default: existing codes are read first so generated ones never collide with them.
  const { data: codeRows } = privacy ? await supabase.from("employees").select("employee_code").eq("company_id", company.id) : { data: [] };
  const existingCodes = ((codeRows ?? []) as { employee_code?: string | null }[]).map((r) => r.employee_code).filter((c): c is string => Boolean(c));
  const result = buildImport({ headers, rows }, mapping, { orgId: company.org_id, companyId: company.id, privacy, existingCodes });
  const skippedErrors = new Set(result.errors.map((e) => e.row)).size;

  // Duplicates: same employee ID, or same name + birth date. A shared name alone is flagged, never dropped.
  // Existing codes are read only in privacy mode, so the normal import never touches the new column.
  const { data: existing, error: exErr } = await supabase
    .from("employees").select(privacy ? "full_name, birth_date, external_ref, employee_code" : "full_name, birth_date, external_ref").eq("company_id", company.id);
  if (exErr) return { ok: false, error: "failed" };
  const dedupe = dedupeEmployees(result.employees, (existing ?? []) as unknown as ExistingEmployee[]);
  const employees = dedupe.keep;
  const keepIds = new Set(employees.map((e) => e.id));
  const contracts = result.contracts.filter((c) => keepIds.has(c.employee_id));
  if (!employees.length) return { ok: false, error: "nothing" };

  // Insert with the user's client so RLS applies. Each insert is a single statement, so atomic on its own.
  // All-or-nothing across the two: if contracts fail, delete the employees just added (their contracts cascade),
  // and report plainly if even that cleanup fails.
  const { error: empErr } = await supabase.from("employees").insert(employees);
  if (empErr) return { ok: false, error: "failed" };
  const { error: conErr } = await supabase.from("contracts").insert(contracts);
  if (conErr) {
    const { error: undoErr } = await supabase.from("employees").delete().in("id", employees.map((e) => e.id));
    return { ok: false, error: undoErr ? "partial" : "failed" };
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
  return { ok: true, imported: employees.length, skippedDuplicates: dedupe.skipped, possibleDuplicates: dedupe.possibleDuplicates, skippedErrors, findings, score, companyId: company.id };
}
