// Plausibility checks for dates and numbers typed or imported. They only warn: the data is still saved,
// because an odd value can be true. Wrong dates silently give a wrong status, so the owner is asked to look twice.
import { addYears, differenceInCalendarYears, format, parseISO } from "date-fns";
import type { IsoDate } from "../rules/types";

export const MIN_AGE = 14;
export const MAX_AGE = 100;
export const MAX_LEAVE_DAYS = 400;

export type SanityKey = "futureStart" | "tooYoung" | "tooOld" | "endBeforeStart" | "probationBeforeStart" | "leaveDays";
export type SanityField = "birth_date" | "start_date" | "end_date" | "probation_end" | "days";

export interface SanityInput {
  birthDate?: IsoDate | null;
  startDate?: IsoDate | null;
  endDate?: IsoDate | null;
  probationEnd?: IsoDate | null;
  leaveDays?: number | null;
}

export interface SanityIssue { field: SanityField; key: SanityKey }

const valid = (d: string | null | undefined): d is IsoDate => Boolean(d) && /^\d{4}-\d{2}-\d{2}$/.test(d as string) && !Number.isNaN(parseISO(d as string).getTime());

/** Full years between `birth` and `today`. */
function ageOn(birth: IsoDate, today: IsoDate): number {
  return differenceInCalendarYears(parseISO(today), parseISO(birth)) - (format(parseISO(today), "MMdd") < format(parseISO(birth), "MMdd") ? 1 : 0);
}

export function sanityIssues(input: SanityInput, today: IsoDate): SanityIssue[] {
  const out: SanityIssue[] = [];
  const { birthDate, startDate, endDate, probationEnd, leaveDays } = input;
  if (valid(birthDate)) {
    const age = ageOn(birthDate, today);
    if (age < MIN_AGE) out.push({ field: "birth_date", key: "tooYoung" });
    else if (age > MAX_AGE) out.push({ field: "birth_date", key: "tooOld" });
  }
  if (valid(startDate)) {
    if (startDate > format(addYears(parseISO(today), 1), "yyyy-MM-dd")) out.push({ field: "start_date", key: "futureStart" });
    if (valid(endDate) && endDate < startDate) out.push({ field: "end_date", key: "endBeforeStart" });
    if (valid(probationEnd) && probationEnd < startDate) out.push({ field: "probation_end", key: "probationBeforeStart" });
  }
  if (typeof leaveDays === "number" && Number.isFinite(leaveDays) && leaveDays > MAX_LEAVE_DAYS) out.push({ field: "days", key: "leaveDays" });
  return out;
}

/** Whole days since `lastUpdated` (an ISO date or timestamp), or null when there is no data at all. */
export function daysSince(lastUpdated: string | null, today: IsoDate): number | null {
  if (!lastUpdated) return null;
  return Math.floor((parseISO(today).getTime() - parseISO(lastUpdated.slice(0, 10)).getTime()) / 86_400_000);
}

/** The owner home asks for a refresh when the data is older than this. */
export const STALE_AFTER_DAYS = 90;
export const isStale = (lastUpdated: string | null, today: IsoDate) => {
  const d = daysSince(lastUpdated, today);
  return d !== null && d > STALE_AFTER_DAYS;
};
