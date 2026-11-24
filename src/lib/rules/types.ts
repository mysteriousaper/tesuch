// Domain types used by the rules engine. Dates are ISO calendar dates ("YYYY-MM-DD").

export type IsoDate = string;

export interface Employee {
  id: string;
  companyId: string;
  birthDate: IsoDate | null;
  sixDayWeek: boolean;
}

export type ContractType = "indefinite" | "fixed_term";
export type TerminationInitiator = "employer" | "employee" | "mutual";

export interface Contract {
  id: string;
  employeeId: string;
  type: ContractType;
  startDate: IsoDate;
  endDate: IsoDate | null;
  probationEnd: IsoDate | null;
  probationSpecialCase: boolean;
  hiredByTransfer: boolean;
  /** null = unknown; "" = explicitly none; text = the ground. */
  fixedTermGround: string | null;
  /** null = unknown (not in the data); never treated as false. */
  srcRegistered: boolean | null;
  terminatedOn: IsoDate | null;
  terminationGround: string | null;
  terminationInitiator: TerminationInitiator | null;
  noticeGivenOn: IsoDate | null;
  workforceReduction: boolean;
  /** Code of the legal ground for the termination, e.g. "113(1)(3)" (Labour Code 113(1) points 1-13, "93(1)" for probation). null/undefined = not recorded. */
  terminationGroundCode?: string | null;
}

export type LeaveType = "annual" | "maternity" | "cash_compensation" | "other";

export interface LeaveRecord {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: IsoDate;
  days: number;
}

export type RuleStatus = "verified" | "needs_lawyer_review";
export type RuleSeverity = "red" | "amber" | "info";
/** Severity after applying rule status: unverified rules are always "advisory". */
export type EffectiveSeverity = RuleSeverity | "advisory";

export interface Finding {
  ruleId: string;
  ruleVersion: number;
  article: string | null;
  sourceUrl: string;
  ruleStatus: RuleStatus;
  severity: EffectiveSeverity;
  companyId: string;
  employeeId: string;
  contractId: string | null;
  dueDate: IsoDate;
  overdue: boolean;
}
