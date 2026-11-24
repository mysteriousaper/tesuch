// Pure dashboard logic, shared by the server actions and unit-tested without a database.
// Database access is passed in as small async functions, so rollback behaviour can be tested with fakes.
import { z } from "zod";
import type { DemoCompany, DemoContract, DemoEmployee } from "./demo-data";

/** Result shape for forms using useActionState. `error` is a key in dashboard.errors. */
export type ActionError = "generic" | "invalid" | "forbidden" | "duplicateCode" | "reasonRequired" | "nothingSelected";
export type ActionState = { ok: true; count?: number; info?: "demoExists" } | { ok: false; error: ActionError } | null;
export const FAIL = (error: ActionError): ActionState => ({ ok: false, error });

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const uuid = z.string().uuid();
const optDate = z.preprocess((v) => (v === "" || v == null ? null : v), isoDate.nullable());
// Missing (field not rendered) and blank both mean "no value".
const optText = z.preprocess((v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : v), z.string().trim().max(300).nullable());
// Tri-state select: "yes" / "no" / blank or missing = unknown (null). Never defaults to a value.
const triState = z.preprocess((v) => (v === "yes" || v === "true" || v === "on" ? true : v === "no" || v === "false" ? false : null), z.boolean().nullable());
const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

export type Role = "owner" | "accountant" | "viewer";
/** Owners and accountants change data; viewers only read. Mirrors private.can_edit in the database. */
export const canEditRole = (role: string | null | undefined): boolean => role === "owner" || role === "accountant";

export const companySchema = z.object({
  name: z.string().trim().min(1).max(200),
  tax_id: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().regex(/^\d{8}$/).nullable()),
});

/** Typed-name confirmation for deleting a company: exact match after trimming, never empty. */
export const confirmsCompanyName = (name: string, typed: unknown): boolean =>
  typeof typed === "string" && typed.trim().length > 0 && typed.trim() === name.trim();

/** Only owners may change or remove a company (stricter than canEditRole). */
export const isOwnerRole = (role: string | null | undefined): boolean => role === "owner";

const employeeFields = z.object({
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
  src_registered: triState,
});

/** Mirrors the contracts table checks so users get a validation message instead of a database error. */
function contractRules<T extends z.ZodType<{ type: string; start_date: string; end_date: string | null; probation_end: string | null }>>(schema: T) {
  return schema
    .refine((v) => v.type === "fixed_term" || v.end_date === null, { path: ["end_date"] })
    .refine((v) => !v.end_date || v.end_date >= v.start_date, { path: ["end_date"] })
    .refine((v) => !v.probation_end || v.probation_end >= v.start_date, { path: ["probation_end"] });
}

/**
 * Manual forms: a fixed-term contract with a blank ground means "none stated" (""), which the
 * fixed-term-ground rule flags. null means unknown (imports with no mapped column) and is skipped.
 */
function blankGroundIsNone<T extends { type: string; fixed_term_ground: string | null }>(v: T): T {
  return v.type === "fixed_term" && v.fixed_term_ground === null ? { ...v, fixed_term_ground: "" } : v;
}

export const employeeSchema = contractRules(employeeFields).transform(blankGroundIsNone);

export const editSchema = contractRules(employeeFields.extend({
  terminated_on: optDate,
  termination_ground: optText,
  termination_initiator: z.preprocess((v) => (v === "" || v == null ? null : v), z.enum(["employer", "employee", "mutual"]).nullable()),
  notice_given_on: optDate,
  workforce_reduction: checkbox,
})).refine((v) => !v.terminated_on || v.terminated_on >= v.start_date, { path: ["terminated_on"] })
  .refine((v) => !v.notice_given_on || !v.terminated_on || v.notice_given_on <= v.terminated_on, { path: ["notice_given_on"] })
  .transform(blankGroundIsNone);

export const leaveSchema = z.object({
  type: z.enum(["annual", "maternity", "cash_compensation", "other"]),
  start_date: isoDate,
  days: z.coerce.number().int().min(1).max(400),
});

export const findingStatusSchema = z.object({
  companyId: uuid,
  findingId: uuid,
  status: z.enum(["open", "fixed", "dismissed"]),
});

/** Written reason for dismissing a finding (3-500 characters once trimmed). */
export const dismissReasonSchema = z.string().trim().min(3).max(500);

export const MAX_BULK_FINDINGS = 200;

/** Bulk fix / dismiss: up to 200 distinct finding ids; reopening is not offered in bulk. A reason is required to dismiss and ignored otherwise. */
export const bulkFindingSchema = z
  .object({
    companyId: uuid,
    ids: z.array(uuid).min(1).max(MAX_BULK_FINDINGS).transform((a) => [...new Set(a)]),
    status: z.enum(["fixed", "dismissed"]),
    reason: z.string().optional(),
  })
  .transform((v, ctx) => {
    if (v.status !== "dismissed") return { companyId: v.companyId, ids: v.ids, status: v.status, reason: null as string | null };
    const r = dismissReasonSchema.safeParse(v.reason ?? "");
    if (!r.success) {
      ctx.addIssue({ code: "custom", message: "reason required", path: ["reason"] });
      return z.NEVER;
    }
    return { companyId: v.companyId, ids: v.ids, status: v.status, reason: r.data };
  });

// ---------- Privacy mode ("code instead of name") ----------

/** Mirrors employees.employee_code check (1-40 characters after trimming). */
export const employeeCodeSchema = z.string().trim().min(1).max(40);

/**
 * Prepares raw form data for the employee schemas, given the firm's privacy mode (read from the database, never from the client).
 * - Privacy on: a code is required and becomes full_name too, so every display shows the code and no name is stored.
 *   Any name sent by the client is discarded.
 * - Privacy off: employee_code is discarded, the name stays required.
 */
export function applyPrivacyIdentity(raw: Record<string, unknown>, privacy: boolean, opts: { generate?: boolean } = {}): { ok: true; raw: Record<string, unknown>; code: string | null } | { ok: false } {
  const { employee_code, ...rest } = raw;
  if (!privacy) return { ok: true, raw: rest, code: null };
  // Codes by default: when adding, an empty code is generated by the database (EMP-001, ...), which also sets full_name.
  if (opts.generate && (employee_code === undefined || (typeof employee_code === "string" && employee_code.trim() === ""))) {
    return { ok: true, raw: { ...rest, full_name: "EMP" }, code: null };
  }
  const code = employeeCodeSchema.safeParse(employee_code);
  if (!code.success) return { ok: false };
  return { ok: true, raw: { ...rest, full_name: code.data }, code: code.data };
}

/** Postgres unique violation (the per-company code index). */
export const isUniqueViolation = (e: unknown): boolean => typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505";

/** Splits validated employee form data into the employees row and the contracts row. employee_code is written only in privacy mode. */
export function splitEmployee<T extends { full_name: string; birth_date: string | null; six_day_week: boolean }>(v: T, code: string | null = null) {
  const { full_name, birth_date, six_day_week, ...contract } = v;
  return { employee: { full_name, birth_date, six_day_week, ...(code ? { employee_code: code } : {}) }, contract };
}

// ---------- Multi-step inserts with rollback ----------

type EmployeeRow = { full_name: string; birth_date: string | null; six_day_week: boolean; employee_code?: string };

export interface EmployeeWriter {
  insertEmployee(row: EmployeeRow): Promise<string>;
  insertContract(employeeId: string, row: Record<string, unknown>): Promise<void>;
  deleteEmployee(employeeId: string): Promise<void>;
}

/** Employee + contract. If the contract fails, the employee is deleted so no contract-less person is left behind. */
export async function insertEmployeeWithContract(
  w: EmployeeWriter, employee: EmployeeRow, contract: Record<string, unknown>,
): Promise<{ ok: true; employeeId: string } | { ok: false; duplicateCode?: true }> {
  let employeeId: string;
  try {
    employeeId = await w.insertEmployee(employee);
  } catch (e) {
    return isUniqueViolation(e) ? { ok: false, duplicateCode: true } : { ok: false };
  }
  try {
    await w.insertContract(employeeId, contract);
    return { ok: true, employeeId };
  } catch {
    await w.deleteEmployee(employeeId).catch(() => undefined);
    return { ok: false };
  }
}

export interface DemoWriter {
  insertCompany(name: string): Promise<string>;
  /** One batched insert per company: the ids are chosen here so contracts and leave can reference them. */
  insertEmployees(companyId: string, rows: { id: string; e: DemoEmployee }[]): Promise<void>;
  insertContracts(rows: { employeeId: string; c: DemoContract }[]): Promise<void>;
  insertLeave(rows: { employeeId: string; l: DemoEmployee["leave"][number] }[]): Promise<void>;
  /** Deleting a company cascades to its employees, contracts, leave and findings. */
  deleteCompanies(ids: string[]): Promise<void>;
}

/**
 * Loads demo companies all-or-nothing: on any failure, every company created in this run is deleted,
 * so a retry is not blocked by a half-loaded set.
 */
export async function insertDemo(w: DemoWriter, demo: DemoCompany[]): Promise<{ ok: true; companyIds: string[] } | { ok: false }> {
  const created: string[] = [];
  try {
    for (const c of demo) {
      const companyId = await w.insertCompany(c.name);
      created.push(companyId);
      // Three statements per company instead of three per employee.
      const rows = c.employees.map((e) => ({ id: crypto.randomUUID(), e }));
      await w.insertEmployees(companyId, rows);
      await w.insertContracts(rows.map(({ id, e }) => ({ employeeId: id, c: e.contract })));
      const leave = rows.flatMap(({ id, e }) => e.leave.map((l) => ({ employeeId: id, l })));
      if (leave.length) await w.insertLeave(leave);
    }
    return { ok: true, companyIds: created };
  } catch {
    if (created.length) await w.deleteCompanies(created).catch(() => undefined);
    return { ok: false };
  }
}

/** The contract shown and edited for an employee: the one that started most recently. */
export function latestContract<T extends { start_date: string }>(contracts: T[] | null | undefined): T | undefined {
  return [...(contracts ?? [])].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
}
