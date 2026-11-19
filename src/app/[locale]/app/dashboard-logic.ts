// Pure dashboard logic, shared by the server actions and unit-tested without a database.
// Database access is passed in as small async functions, so rollback behaviour can be tested with fakes.
import { z } from "zod";
import type { DemoCompany, DemoContract, DemoEmployee } from "./demo-data";

/** Result shape for forms using useActionState. `error` is a key in dashboard.errors. */
export type ActionError = "generic" | "invalid" | "forbidden";
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

/** Splits validated employee form data into the employees row and the contracts row. */
export function splitEmployee<T extends { full_name: string; birth_date: string | null; six_day_week: boolean }>(v: T) {
  const { full_name, birth_date, six_day_week, ...contract } = v;
  return { employee: { full_name, birth_date, six_day_week }, contract };
}

// ---------- Multi-step inserts with rollback ----------

export interface EmployeeWriter {
  insertEmployee(row: { full_name: string; birth_date: string | null; six_day_week: boolean }): Promise<string>;
  insertContract(employeeId: string, row: Record<string, unknown>): Promise<void>;
  deleteEmployee(employeeId: string): Promise<void>;
}

/** Employee + contract. If the contract fails, the employee is deleted so no contract-less person is left behind. */
export async function insertEmployeeWithContract(
  w: EmployeeWriter, employee: { full_name: string; birth_date: string | null; six_day_week: boolean }, contract: Record<string, unknown>,
): Promise<{ ok: true; employeeId: string } | { ok: false }> {
  let employeeId: string;
  try {
    employeeId = await w.insertEmployee(employee);
  } catch {
    return { ok: false };
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
  insertEmployee(companyId: string, e: DemoEmployee): Promise<string>;
  insertContract(employeeId: string, c: DemoContract): Promise<void>;
  insertLeave(employeeId: string, leave: DemoEmployee["leave"]): Promise<void>;
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
      for (const e of c.employees) {
        const employeeId = await w.insertEmployee(companyId, e);
        await w.insertContract(employeeId, e.contract);
        if (e.leave.length) await w.insertLeave(employeeId, e.leave);
      }
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
