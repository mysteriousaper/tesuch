import Papa from "papaparse";
import type { TargetField } from "@/lib/import";

/** Max data rows per import (also enforced server-side). */
export const MAX_IMPORT_ROWS = 2000;

/** Columns in the downloadable template, in order. Headers are localized labels the auto-mapper recognises. */
export const TEMPLATE_FIELDS: TargetField[] = [
  "external_ref",
  "full_name",
  "birth_date",
  "six_day_week",
  "contract_type",
  "start_date",
  "end_date",
  "probation_end",
  "probation_special_case",
  "hired_by_transfer",
  "fixed_term_ground",
  "src_registered",
  "terminated_on",
  "termination_ground",
  "termination_initiator",
  "notice_given_on",
  "workforce_reduction",
];

const WORDS = {
  hy: { yes: "այո", no: "ոչ", fixed: "որոշակի ժամկետով" },
  ru: { yes: "да", no: "нет", fixed: "срочный" },
  en: { yes: "yes", no: "no", fixed: "fixed term" },
} as const;

/** CSV with a UTF-8 BOM so Excel opens Armenian/Cyrillic correctly. */
export function templateCsv(
  locale: keyof typeof WORDS,
  label: (f: TargetField) => string,
  sample: { name: string; ground: string },
  opts: { privacy?: boolean } = {},
): string {
  const w = WORDS[locale];
  const row: Record<TargetField, string> = {
    external_ref: "001", full_name: sample.name, birth_date: "15.03.1990", six_day_week: w.no, contract_type: w.fixed,
    start_date: "15.01.2026", end_date: "14.01.2027", probation_end: "14.04.2026", probation_special_case: w.no,
    hired_by_transfer: w.no, fixed_term_ground: sample.ground, src_registered: w.yes, terminated_on: "",
    termination_ground: "", termination_initiator: "", notice_given_on: "", workforce_reduction: w.no,
    first_name: "", last_name: "", patronymic: "", employee_code: "EMP-014",
  };
  // Privacy mode template: the code replaces the name and the employee ID columns.
  const fields = opts.privacy
    ? ["employee_code" as const, ...TEMPLATE_FIELDS.filter((f) => f !== "full_name" && f !== "external_ref")]
    : TEMPLATE_FIELDS;
  return "﻿" + Papa.unparse([fields.map(label), fields.map((f) => row[f])]);
}
