import { z } from "zod";
import type { ContractType, IsoDate, TerminationInitiator } from "../rules/types";
import type { TargetField } from "./fields";
import type { ColumnMapping } from "./mapping";
import { parseBool, parseContractType, parseDate, parseInitiator, parseText, type Parsed, type RawCell } from "./normalize";
import type { RawTable } from "./parse";

/** Message keys are translated in the UI (messages/{hy,ru,en}.json → import.error.*). */
export type ImportErrorKey =
  | "import.error.required"
  | "import.error.invalidDate"
  | "import.error.invalidBoolean"
  | "import.error.invalidContractType"
  | "import.error.invalidInitiator"
  | "import.error.tooLong"
  | "import.error.endBeforeStart"
  | "import.error.probationBeforeStart"
  | "import.error.endDateOnIndefinite"
  | "import.error.fixedTermWithoutEnd"
  | "import.error.terminationBeforeStart";

export interface ImportError {
  row: number;
  field: TargetField;
  key: ImportErrorKey;
}

/** Shapes match public.employees / public.contracts so they can be inserted as-is. */
export interface EmployeeInsert {
  id: string;
  org_id: string;
  company_id: string;
  full_name: string;
  birth_date: IsoDate | null;
  six_day_week: boolean;
  external_ref: string | null;
}

export interface ContractInsert {
  id: string;
  org_id: string;
  employee_id: string;
  type: ContractType;
  start_date: IsoDate;
  end_date: IsoDate | null;
  probation_end: IsoDate | null;
  probation_special_case: boolean;
  hired_by_transfer: boolean;
  fixed_term_ground: string | null;
  src_registered: boolean;
  terminated_on: IsoDate | null;
  termination_ground: string | null;
  termination_initiator: TerminationInitiator | null;
  notice_given_on: IsoDate | null;
  workforce_reduction: boolean;
}

export interface ImportResult {
  employees: EmployeeInsert[];
  contracts: ContractInsert[];
  errors: ImportError[];
  /** Data rows seen (blank rows excluded). */
  rowCount: number;
}

export interface ImportOptions {
  orgId: string;
  companyId: string;
  /** Injected for deterministic tests; defaults to crypto.randomUUID. */
  newId?: () => string;
}

const DATE_FIELDS = ["birth_date", "start_date", "end_date", "probation_end", "terminated_on", "notice_given_on"] as const;
const BOOL_FIELDS = ["six_day_week", "probation_special_case", "hired_by_transfer", "src_registered", "workforce_reduction"] as const;
const TEXT_FIELDS = ["full_name", "first_name", "last_name", "patronymic", "external_ref", "fixed_term_ground", "termination_ground"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Cross-field rules, mirroring the CHECK constraints in the migration. */
const rowSchema = z
  .object({
    full_name: z.string().min(1, "import.error.required").max(200, "import.error.tooLong"),
    birth_date: isoDate.nullable(),
    start_date: isoDate.nullable().refine((v) => v !== null, "import.error.required"),
    end_date: isoDate.nullable(),
    probation_end: isoDate.nullable(),
    terminated_on: isoDate.nullable(),
    contract_type: z.enum(["indefinite", "fixed_term"]).nullable(),
  })
  .superRefine((r, ctx) => {
    const issue = (path: TargetField, message: ImportErrorKey) => ctx.addIssue({ code: "custom", path: [path], message });
    if (!r.start_date) return;
    if (r.end_date && r.end_date < r.start_date) issue("end_date", "import.error.endBeforeStart");
    if (r.probation_end && r.probation_end < r.start_date) issue("probation_end", "import.error.probationBeforeStart");
    if (r.terminated_on && r.terminated_on < r.start_date) issue("terminated_on", "import.error.terminationBeforeStart");
    if (r.contract_type === "indefinite" && r.end_date) issue("end_date", "import.error.endDateOnIndefinite");
    if (r.contract_type === "fixed_term" && !r.end_date) issue("end_date", "import.error.fixedTermWithoutEnd");
  });

/**
 * Turn a raw table + column mapping into insert-ready rows. Never throws:
 * every problem becomes an ImportError, and a row with any error is left out of the output.
 */
export function buildImport(table: RawTable, mapping: ColumnMapping, opts: ImportOptions): ImportResult {
  const newId = opts.newId ?? (() => crypto.randomUUID());
  const columnOf = new Map<TargetField, number>();
  for (const [col, field] of Object.entries(mapping)) if (field) columnOf.set(field, Number(col));

  const result: ImportResult = { employees: [], contracts: [], errors: [], rowCount: table.rows.length };

  for (const { rowNumber, cells } of table.rows) {
    const errors: ImportError[] = [];
    const cell = (f: TargetField): RawCell => {
      const c = columnOf.get(f);
      return c === undefined ? null : cells[c];
    };
    const take = <T>(f: TargetField, parsed: Parsed<T>, key: ImportErrorKey, fallback: T): T => {
      if (parsed.ok) return parsed.value;
      errors.push({ row: rowNumber, field: f, key });
      return fallback;
    };

    const dates = Object.fromEntries(DATE_FIELDS.map((f) => [f, take(f, parseDate(cell(f)), "import.error.invalidDate", null)])) as Record<(typeof DATE_FIELDS)[number], IsoDate | null>;
    const bools = Object.fromEntries(BOOL_FIELDS.map((f) => [f, take(f, parseBool(cell(f)), "import.error.invalidBoolean", false)])) as Record<(typeof BOOL_FIELDS)[number], boolean>;
    const texts = Object.fromEntries(TEXT_FIELDS.map((f) => [f, take(f, parseText(cell(f)), "import.error.tooLong", null)])) as Record<(typeof TEXT_FIELDS)[number], string | null>;
    const contractType = take("contract_type", parseContractType(cell("contract_type")), "import.error.invalidContractType", null);
    const initiator = take("termination_initiator", parseInitiator(cell("termination_initiator")), "import.error.invalidInitiator", null);

    const fullName = texts.full_name ?? [texts.last_name, texts.first_name, texts.patronymic].filter(Boolean).join(" ");

    const check = rowSchema.safeParse({
      full_name: fullName,
      birth_date: dates.birth_date,
      start_date: dates.start_date,
      end_date: dates.end_date,
      probation_end: dates.probation_end,
      terminated_on: dates.terminated_on,
      contract_type: contractType,
    });
    if (!check.success) {
      for (const issue of check.error.issues) {
        const field = issue.path[0] as TargetField;
        // Date fields that failed parsing already have a more specific error.
        if (!errors.some((e) => e.field === field)) errors.push({ row: rowNumber, field, key: issue.message as ImportErrorKey });
      }
    }

    if (errors.length > 0) {
      result.errors.push(...errors);
      continue;
    }

    const employeeId = newId();
    result.employees.push({
      id: employeeId,
      org_id: opts.orgId,
      company_id: opts.companyId,
      full_name: fullName,
      birth_date: dates.birth_date,
      six_day_week: bools.six_day_week,
      external_ref: texts.external_ref,
    });
    result.contracts.push({
      id: newId(),
      org_id: opts.orgId,
      employee_id: employeeId,
      type: contractType ?? (dates.end_date ? "fixed_term" : "indefinite"),
      start_date: dates.start_date!,
      end_date: dates.end_date,
      probation_end: dates.probation_end,
      probation_special_case: bools.probation_special_case,
      hired_by_transfer: bools.hired_by_transfer,
      fixed_term_ground: texts.fixed_term_ground,
      src_registered: bools.src_registered,
      terminated_on: dates.terminated_on,
      termination_ground: texts.termination_ground,
      termination_initiator: initiator,
      notice_given_on: dates.notice_given_on,
      workforce_reduction: bools.workforce_reduction,
    });
  }
  return result;
}
