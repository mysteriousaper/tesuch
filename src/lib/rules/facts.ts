import { addDays, addMonths, addYears, differenceInCalendarDays, differenceInYears, parseISO } from "date-fns";
import type { Contract, Employee, IsoDate, LeaveRecord } from "./types";

export interface RuleContext {
  asOf: IsoDate;
  employee: Employee;
  /** The contract being evaluated (for employee-scope rules: the primary contract). */
  contract: Contract;
  /** All contracts of this employee with this company. */
  contracts: Contract[];
  leave: LeaveRecord[];
  /** True when the company has at least one leave record (leave data was provided at all). */
  companyHasLeave?: boolean;
}

const d = (iso: IsoDate) => parseISO(iso);
const days = (to: IsoDate, from: IsoDate) => differenceInCalendarDays(d(to), d(from));

export function serviceStart(ctx: RuleContext): IsoDate {
  return ctx.contracts.map((c) => c.startDate).reduce((a, b) => (a < b ? a : b), ctx.contract.startDate);
}

export function isTerminated(c: Contract, asOf: IsoDate): boolean {
  return c.terminatedOn !== null && c.terminatedOn <= asOf;
}

export function isActive(c: Contract, asOf: IsoDate): boolean {
  return !isTerminated(c, asOf) && c.startDate <= asOf && (c.endDate === null || c.endDate >= asOf);
}

/** Another contract of the same employee continues the work: starts on/after this one's end, or is open-ended and active. */
export function hasSuccessorContract(c: Contract, contracts: Contract[], asOf: IsoDate): boolean {
  if (!c.endDate) return false;
  const end = c.endDate;
  return contracts.some((o) => o.id !== c.id && (o.startDate >= end || (o.endDate === null && isActive(o, asOf))));
}

/** Days past the last allowed probation day. Last allowed day = start + maxMonths - 1 day. */
export function probationOverrunDays(c: Contract, maxMonths: number): number {
  if (!c.probationEnd) return 0;
  const lastAllowed = addDays(addMonths(d(c.startDate), maxMonths), -1);
  return differenceInCalendarDays(d(c.probationEnd), lastAllowed);
}

/** Shortfall of annual leave started within the last completed working year. 0 if no full year yet. */
export function annualLeaveShortfallDays(ctx: RuleContext, fiveDayWeek: number, sixDayWeek: number): number {
  const start = d(serviceStart(ctx));
  const asOf = d(ctx.asOf);
  const completedYears = differenceInYears(asOf, start);
  if (completedYears < 1) return 0;
  const yearStart = addYears(start, completedYears - 1);
  const yearEnd = addYears(start, completedYears); // exclusive
  const taken = ctx.leave
    .filter((l) => l.type === "annual")
    .filter((l) => d(l.startDate) >= yearStart && d(l.startDate) < yearEnd)
    .reduce((sum, l) => sum + l.days, 0);
  const minimum = ctx.employee.sixDayWeek ? sixDayWeek : fiveDayWeek;
  return Math.max(0, minimum - taken);
}

export interface NoticeParams {
  tiers: { minYears: number; days: number }[];
  workforceReductionMonths: number;
}

/** Days of notice missing for an employer-initiated termination. */
export function noticeShortfallDays(ctx: RuleContext, p: NoticeParams): number {
  const c = ctx.contract;
  if (!c.terminatedOn) return 0;
  const noticeOn = c.noticeGivenOn ?? c.terminatedOn;
  let earliestEnd: Date;
  if (c.workforceReduction) {
    earliestEnd = addMonths(d(noticeOn), p.workforceReductionMonths);
  } else {
    const years = differenceInYears(d(noticeOn), d(serviceStart(ctx)));
    const tier = [...p.tiers].sort((a, b) => b.minYears - a.minYears).find((t) => years >= t.minYears);
    earliestEnd = addDays(d(noticeOn), tier?.days ?? 0);
  }
  return Math.max(0, differenceInCalendarDays(earliestEnd, d(c.terminatedOn)));
}

/** Base facts. Unknown values use sentinels that can never satisfy a rule (e.g. age = Infinity). */
export function baseFacts(ctx: RuleContext): Record<string, unknown> {
  const c = ctx.contract;
  const e = ctx.employee;
  const terminated = isTerminated(c, ctx.asOf);
  const maternity = ctx.leave.filter((l) => l.type === "maternity").map((l) => l.days);
  return {
    hasProbation: c.probationEnd !== null,
    ageAtStart: e.birthDate ? differenceInYears(d(c.startDate), d(e.birthDate)) : Number.POSITIVE_INFINITY,
    hiredByTransfer: c.hiredByTransfer,
    probationSpecialCase: c.probationSpecialCase,
    isActive: isActive(c, ctx.asOf),
    daysUntilProbationEnd: c.probationEnd ? days(c.probationEnd, ctx.asOf) : Number.NEGATIVE_INFINITY,
    isFixedTerm: c.type === "fixed_term",
    fixedTermGroundKnown: c.fixedTermGround !== null,
    hasFixedTermGround: (c.fixedTermGround ?? "").trim().length > 0,
    daysUntilContractEnd: c.endDate ? days(c.endDate, ctx.asOf) : Number.NEGATIVE_INFINITY,
    hasSuccessorContract: hasSuccessorContract(c, ctx.contracts, ctx.asOf),
    isTerminated: terminated,
    hasTerminationGround: (c.terminationGround ?? "").trim().length > 0,
    isEmployerTermination: terminated && c.terminationInitiator === "employer",
    cashCompensatedLeaveCount: ctx.leave.filter((l) => l.type === "cash_compensation").length,
    shortestMaternityLeaveDays: maternity.length ? Math.min(...maternity) : Number.POSITIVE_INFINITY,
    srcRegistered: c.srcRegistered,
    srcRegisteredKnown: c.srcRegistered !== null,
    // Company-level: an employee with no leave is checked (0 days taken) once any leave exists in the company.
    hasLeaveRecords: ctx.companyHasLeave ?? ctx.leave.length > 0,
  };
}

/** Facts that take parameters from the rule JSON, so thresholds live in versioned rules, not code. */
export const paramFacts: Record<string, (ctx: RuleContext, params: Record<string, unknown>) => number> = {
  probationOverrunDays: (ctx, p) => probationOverrunDays(ctx.contract, Number(p.maxMonths)),
  annualLeaveShortfallDays: (ctx, p) => annualLeaveShortfallDays(ctx, Number(p.fiveDayWeek), Number(p.sixDayWeek)),
  noticeShortfallDays: (ctx, p) => noticeShortfallDays(ctx, p as unknown as NoticeParams),
};
