import type { RuleDefinition } from "@/lib/rules/schema";
import type { Contract, Employee, LeaveRecord } from "@/lib/rules/types";

// Database rows (snake_case) → engine types (camelCase). Kept explicit so a schema change fails typecheck here.

export interface EmployeeRow { id: string; company_id: string; birth_date: string | null; six_day_week: boolean }
export interface ContractRow {
  id: string; employee_id: string; type: Contract["type"]; start_date: string; end_date: string | null; probation_end: string | null;
  probation_special_case: boolean; hired_by_transfer: boolean; fixed_term_ground: string | null; src_registered: boolean | null;
  terminated_on: string | null; termination_ground: string | null; termination_initiator: Contract["terminationInitiator"];
  notice_given_on: string | null; workforce_reduction: boolean; termination_ground_code?: string | null;
}
export interface LeaveRow { id: string; employee_id: string; type: LeaveRecord["type"]; start_date: string; days: number }

export const toEmployee = (r: EmployeeRow): Employee => ({ id: r.id, companyId: r.company_id, birthDate: r.birth_date, sixDayWeek: r.six_day_week });

export const toContract = (r: ContractRow): Contract => ({
  id: r.id, employeeId: r.employee_id, type: r.type, startDate: r.start_date, endDate: r.end_date, probationEnd: r.probation_end,
  probationSpecialCase: r.probation_special_case, hiredByTransfer: r.hired_by_transfer, fixedTermGround: r.fixed_term_ground,
  srcRegistered: r.src_registered, terminatedOn: r.terminated_on, terminationGround: r.termination_ground,
  terminationInitiator: r.termination_initiator, noticeGivenOn: r.notice_given_on, workforceReduction: r.workforce_reduction, terminationGroundCode: r.termination_ground_code ?? null,
});

export const toLeave = (r: LeaveRow): LeaveRecord => ({ id: r.id, employeeId: r.employee_id, type: r.type, startDate: r.start_date, days: r.days });

export const toRuleRow = (r: RuleDefinition) => ({
  id: r.id, version: r.version, article: r.article, status: r.status, definition: r, source_url: r.source_url,
});
