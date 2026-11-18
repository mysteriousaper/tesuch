"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildImport, TARGET_FIELDS, missingRequiredFields, type ColumnMapping, type EmployeeInsert } from "@/lib/import";
import { ensureRules, runRulesForCompany } from "@/lib/jobs/run";
import type { Locale } from "@/lib/notify/i18n";
import { supabaseForUser, supabaseService } from "@/lib/supabase/server";

import { MAX_IMPORT_ROWS } from "@/components/import/template";
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
      skippedErrors: number;
      findings: number | null;
      score: number | null;
      companyId: string;
    }
  | { ok: false; error: "forbidden" | "invalid" | "nothing" | "failed" };

const dupKey = (e: Pick<EmployeeInsert, "full_name" | "birth_date">) => `${e.full_name.trim().toLocaleLowerCase()}|${e.birth_date ?? ""}`;

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
  if (missingRequiredFields(mapping).length) return { ok: false, error: "invalid" };

  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "forbidden" };

  // RLS: the company is only visible to members; org_id comes from the database, not the client.
  const { data: company } = await supabase.from("companies").select("id, org_id, name, orgs(locale)").eq("id", companyId).maybeSingle();
  if (!company) return { ok: false, error: "forbidden" };
  const { data: membership } = await supabase
    .from("memberships").select("role").eq("org_id", company.org_id).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "accountant"].includes(membership.role)) return { ok: false, error: "forbidden" };

  const result = buildImport({ headers, rows }, mapping, { orgId: company.org_id, companyId: company.id });
  const skippedErrors = new Set(result.errors.map((e) => e.row)).size;

  // Duplicates: same external_ref, or same name + birth date, already in the company or earlier in the file.
  const { data: existing, error: exErr } = await supabase
    .from("employees").select("full_name, birth_date, external_ref").eq("company_id", company.id);
  if (exErr) return { ok: false, error: "failed" };
  const refs = new Set((existing ?? []).map((e) => e.external_ref).filter(Boolean).map((r) => String(r).trim().toLocaleLowerCase()));
  const keys = new Set((existing ?? []).map((e) => dupKey(e)));

  const keepIds = new Set<string>();
  let skippedDuplicates = 0;
  for (const e of result.employees) {
    const ref = e.external_ref?.trim().toLocaleLowerCase();
    if ((ref && refs.has(ref)) || keys.has(dupKey(e))) {
      skippedDuplicates++;
      continue;
    }
    if (ref) refs.add(ref);
    keys.add(dupKey(e));
    keepIds.add(e.id);
  }
  const employees = result.employees.filter((e) => keepIds.has(e.id));
  const contracts = result.contracts.filter((c) => keepIds.has(c.employee_id));
  if (!employees.length) return { ok: false, error: "nothing" };

  // Insert with the user's client so RLS applies. If contracts fail, remove the employees (contracts cascade).
  const { error: empErr } = await supabase.from("employees").insert(employees);
  if (empErr) return { ok: false, error: "failed" };
  const { error: conErr } = await supabase.from("contracts").insert(contracts);
  if (conErr) {
    await supabase.from("employees").delete().in("id", employees.map((e) => e.id));
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
  return { ok: true, imported: employees.length, skippedDuplicates, skippedErrors, findings, score, companyId: company.id };
}
