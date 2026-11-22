import { z } from "zod";
import type { ContractType, IsoDate, TerminationInitiator } from "../rules/types";
import { NAME_FIELDS, type TargetField } from "./fields";
import type { ColumnMapping } from "./mapping";
import { sanityIssues, type SanityKey } from "./sanity";
import { parseBool, parseContractType, parseDate, parseGround, parseInitiator, parseText, type Parsed, type RawCell } from "./normalize";
import type { RawTable } from "./parse";

/** Message keys are translated in the UI (messages/{hy,ru,en}.json → import.error.*). */
export type ImportErrorKey =
  | "import.error.required"
  | "import.error.invalidDate"
  | "import.error.invalidBoolean"
  | "import.error.invalidContractType"
  | "import.error.invalidInitiator"
  | "import.error.tooLong"
  | "import.error.duplicateCode"
  | "import.error.endBeforeStart"
  | "import.error.probationBeforeStart"
  | "import.error.endDateOnIndefinite"
  | "import.error.fixedTermWithoutEnd"
  | "import.error.terminationBeforeStart";

/** Plausibility warnings: the row is still imported. Messages: import.sanity.<key>. */
export interface ImportWarning {
  row: number;
  field: TargetField;
  key: SanityKey;
}

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
  /** Present only in privacy mode (then full_name equals it). Absent otherwise, so the column is never written without need. */
  employee_code?: string;
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
  /** null = not in the file (unknown); rules skip it. */
  src_registered: boolean | null;
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
  warnings: ImportWarning[];
  /** Data rows seen (blank rows excluded). */
  rowCount: number;
  /** Ids of employees whose code was generated (the file had none): their identity is the employee ID, not the code. */
  generatedCodeIds: string[];
}

export interface ImportOptions {
  orgId: string;
  companyId: string;
  /** Injected for deterministic tests; defaults to crypto.randomUUID. */
  newId?: () => string;
  /** Privacy mode: the code replaces the name. Name columns are ignored and never stored; the code is required and unique in the file. */
  privacy?: boolean;
  /** Privacy mode: codes already used in the company, so generated codes never collide with them. */
  existingCodes?: Iterable<string>;
  /** Injected for deterministic tests; defaults to today. */
  today?: IsoDate;
}

/** Mirrors employees.employee_code check (1-40 characters). */
export const MAX_CODE_LENGTH = 40;

/** Codes compare case-insensitively inside the app (the database index is exact, so this is stricter). */
export const codeKey = (code: string) => code.normalize("NFC").trim().toLocaleLowerCase();

/** Next free code like EMP-001, EMP-002 ... (case-insensitive against `used`; the new code is added to it). */
export function nextCode(used: Set<string>): string {
  let n = 1;
  while (used.has(codeKey(`EMP-${String(n).padStart(3, "0")}`))) n += 1;
  const code = `EMP-${String(n).padStart(3, "0")}`;
  used.add(codeKey(code));
  return code;
}

const DATE_FIELDS = ["birth_date", "start_date", "end_date", "probation_end", "terminated_on", "notice_given_on"] as const;
const BOOL_FIELDS = ["six_day_week", "probation_special_case", "hired_by_transfer", "workforce_reduction"] as const;
const TEXT_FIELDS = ["full_name", "first_name", "last_name", "patronymic", "employee_code", "external_ref", "termination_ground"] as const;

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

  const result: ImportResult = { employees: [], contracts: [], errors: [], warnings: [], rowCount: table.rows.length, generatedCodeIds: [] };
  const privacy = opts.privacy === true;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const seenCodes = new Set<string>();
  const usedCodes = new Set<string>([...(opts.existingCodes ?? [])].map(codeKey));

  // Codes typed in the file are reserved first, so a generated code never takes one that appears further down.
  const codeCol = columnOf.get("employee_code");
  if (privacy && codeCol !== undefined) {
    for (const { cells } of table.rows) {
      const p = parseText(cells[codeCol]);
      if (p.ok && p.value) usedCodes.add(codeKey(p.value));
    }
  }

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
    const bools = Object.fromEntries(BOOL_FIELDS.map((f) => [f, take(f, parseBool(cell(f)), "import.error.invalidBoolean", null)])) as Record<(typeof BOOL_FIELDS)[number], boolean | null>;
    // Unknown (blank or unmapped) stays null: these tri-state values are never defaulted to false.
    const srcRegistered = take("src_registered", parseBool(cell("src_registered")), "import.error.invalidBoolean", null);
    const fixedTermGround = take("fixed_term_ground", parseGround(cell("fixed_term_ground")), "import.error.tooLong", null);
    // Privacy mode never reads name columns; outside privacy mode the code column is not read.
    const skipped = (f: TargetField) => (privacy ? NAME_FIELDS.includes(f) : f === "employee_code");
    const texts = Object.fromEntries(TEXT_FIELDS.map((f) => [f, skipped(f) ? null : take(f, parseText(cell(f)), "import.error.tooLong", null)])) as Record<(typeof TEXT_FIELDS)[number], string | null>;
    const contractType = take("contract_type", parseContractType(cell("contract_type")), "import.error.invalidContractType", null);
    const initiator = take("termination_initiator", parseInitiator(cell("termination_initiator")), "import.error.invalidInitiator", null);

    let code = privacy ? texts.employee_code : null;
    // Codes by default: a row without a code gets one generated after the row passes validation.
    const needsCode = privacy && !code;
    if (privacy) {
      if (!code) {
        // generated below
      } else if (code.length > MAX_CODE_LENGTH) errors.push({ row: rowNumber, field: "employee_code", key: "import.error.tooLong" });
      else if (seenCodes.has(codeKey(code))) errors.push({ row: rowNumber, field: "employee_code", key: "import.error.duplicateCode" });
    }
    let fullName = privacy ? (code ?? "EMP") : texts.full_name ?? [texts.last_name, texts.first_name, texts.patronymic].filter(Boolean).join(" ");

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
        const field = (privacy && issue.path[0] === "full_name" ? "employee_code" : issue.path[0]) as TargetField;
        // Date fields that failed parsing already have a more specific error.
        if (!errors.some((e) => e.field === field)) errors.push({ row: rowNumber, field, key: issue.message as ImportErrorKey });
      }
    }

    if (errors.length > 0) {
      result.errors.push(...errors);
      continue;
    }

    for (const w of sanityIssues({ birthDate: dates.birth_date, startDate: dates.start_date, endDate: dates.end_date, probationEnd: dates.probation_end }, today)) {
      result.warnings.push({ row: rowNumber, field: w.field as TargetField, key: w.key });
    }

    if (needsCode) {
      code = nextCode(usedCodes);
      fullName = code;
    }
    if (code) {
      seenCodes.add(codeKey(code));
      usedCodes.add(codeKey(code));
    }
    const employeeId = newId();
    if (needsCode) result.generatedCodeIds.push(employeeId);
    result.employees.push({
      id: employeeId,
      org_id: opts.orgId,
      company_id: opts.companyId,
      full_name: fullName,
      birth_date: dates.birth_date,
      six_day_week: bools.six_day_week ?? false,
      external_ref: texts.external_ref,
      ...(privacy && code ? { employee_code: code } : {}),
    });
    result.contracts.push({
      id: newId(),
      org_id: opts.orgId,
      employee_id: employeeId,
      type: contractType ?? (dates.end_date ? "fixed_term" : "indefinite"),
      start_date: dates.start_date!,
      end_date: dates.end_date,
      probation_end: dates.probation_end,
      probation_special_case: bools.probation_special_case ?? false,
      hired_by_transfer: bools.hired_by_transfer ?? false,
      fixed_term_ground: fixedTermGround,
      src_registered: srcRegistered,
      terminated_on: dates.terminated_on,
      termination_ground: texts.termination_ground,
      termination_initiator: initiator,
      notice_given_on: dates.notice_given_on,
      workforce_reduction: bools.workforce_reduction ?? false,
    });
  }
  return result;
}

/** Optional fields whose absence makes a rule skip (unknown, not "all fine"). Rule ids are shown in the preview. */
export const OPTIONAL_FIELD_IMPACT: Partial<Record<TargetField, string[]>> = {
  src_registered: ["src-registration"],
  fixed_term_ground: ["fixed-term-ground"],
  birth_date: ["probation-minor"],
};

/** Optional fields not mapped to any column, with the rules that therefore cannot run. */
export function unmappedImpact(mapping: ColumnMapping): { field: TargetField; rules: string[] }[] {
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  return (Object.entries(OPTIONAL_FIELD_IMPACT) as [TargetField, string[]][])
    .filter(([f]) => !mapped.has(f))
    .map(([field, rules]) => ({ field, rules }));
}
