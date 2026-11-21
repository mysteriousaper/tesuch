// Free file check. Runs only in the browser: reads the file, maps columns, builds employees and contracts,
// runs the rules engine and returns a readiness status. Nothing here makes a network request.
import {
  autoMap, buildImport, decodeCsv, detectHeaderRow, missingRequiredFields, parseCsv, toMapping, toTable, unmappedImpact,
  type ImportError, type RawCell, type TargetField,
} from "@/lib/import";
import { readinessStatus, type Readiness } from "@/lib/readiness";
import { RULES } from "@/lib/rules/catalog";
import { evaluateCompany } from "@/lib/rules/engine";
import { inspectionReadyScore } from "@/lib/rules/score";
import type { Contract, Employee } from "@/lib/rules/types";

const MAX_ROWS = 2000;

export interface IssueGroup {
  ruleId: string;
  title: { hy: string; ru: string; en: string };
  codes: string[];
}

export interface FileCheckResult {
  status: Exclude<Readiness, "none">;
  score: number;
  staff: number;
  rowCount: number;
  groups: IssueGroup[];
  errors: ImportError[];
  /** Optional columns not found, so the rules that need them could not run. */
  missing: TargetField[];
}

export type FileCheckOutcome = { kind: "ok"; result: FileCheckResult } | { kind: "empty" | "tooMany" | "noStart" | "unreadable" };

async function readGrid(file: File): Promise<RawCell[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readXlsxGrid } = await import("@/lib/import/xlsx-browser");
    return readXlsxGrid(file);
  }
  return parseCsv(decodeCsv(await file.arrayBuffer()).text);
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export async function checkStaffFile(file: File): Promise<FileCheckOutcome> {
  const grid = await readGrid(file);
  const table = toTable(grid, { headerRow: detectHeaderRow(grid) });
  if (!table.headers.length || !table.rows.length) return { kind: "empty" };
  if (table.rows.length > MAX_ROWS) return { kind: "tooMany" };

  // Codes mode: names in the file are ignored, and a code is generated for rows without one.
  const mapping = toMapping(autoMap(table.headers, { privacy: true }));
  if (missingRequiredFields(mapping, { privacy: true }).length > 0) return { kind: "noStart" };
  const built = buildImport(table, mapping, { orgId: "browser", companyId: "browser", privacy: true });
  if (built.employees.length === 0) return { kind: built.errors.length ? "noStart" : "empty" };

  const employees: Employee[] = built.employees.map((e) => ({ id: e.id, companyId: e.company_id, birthDate: e.birth_date, sixDayWeek: e.six_day_week }));
  const contracts: Contract[] = built.contracts.map((c) => ({
    id: c.id, employeeId: c.employee_id, type: c.type, startDate: c.start_date, endDate: c.end_date, probationEnd: c.probation_end,
    probationSpecialCase: c.probation_special_case, hiredByTransfer: c.hired_by_transfer, fixedTermGround: c.fixed_term_ground,
    srcRegistered: c.src_registered, terminatedOn: c.terminated_on, terminationGround: c.termination_ground,
    terminationInitiator: c.termination_initiator, noticeGivenOn: c.notice_given_on, workforceReduction: c.workforce_reduction,
  }));
  const findings = (await evaluateCompany(RULES, { employees, contracts, leave: [] }, todayIso())).filter((f) => f.severity !== "info");

  const score = inspectionReadyScore(findings);
  const status = readinessStatus({ score, staff: employees.length, overdueScoring: findings.filter((f) => f.overdue).length }) as FileCheckResult["status"];
  const codeOf = new Map(built.employees.map((e) => [e.id, e.full_name]));
  const byRule = new Map<string, Set<string>>();
  for (const f of findings) {
    if (!byRule.has(f.ruleId)) byRule.set(f.ruleId, new Set());
    byRule.get(f.ruleId)!.add(codeOf.get(f.employeeId) ?? "");
  }
  const groups: IssueGroup[] = [...byRule].map(([ruleId, codes]) => ({
    ruleId,
    title: RULES.find((r) => r.id === ruleId)!.title,
    codes: [...codes],
  }));
  return {
    kind: "ok",
    result: { status, score, staff: employees.length, rowCount: built.rowCount, groups, errors: built.errors, missing: unmappedImpact(mapping).map((m) => m.field) },
  };
}
