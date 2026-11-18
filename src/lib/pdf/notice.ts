// Dismissal notice dates, using the thresholds stored in rules/notice-period.json (never hard-coded here).
import { addDays, addMonths, differenceInYears, format, parseISO } from "date-fns";
import { ruleById } from "../notify/i18n";
import type { NoticeParams } from "../rules/facts";
import type { IsoDate } from "../rules/types";

type Cond = { fact?: string; params?: unknown; all?: Cond[]; any?: Cond[] };

function findParams(c: Cond): NoticeParams | undefined {
  if (c.fact === "noticeShortfallDays") return c.params as NoticeParams;
  for (const child of [...(c.all ?? []), ...(c.any ?? [])]) {
    const p = findParams(child);
    if (p) return p;
  }
  return undefined;
}

export function noticeParams(): NoticeParams {
  const p = findParams(ruleById("notice-period").conditions as Cond);
  if (!p) throw new Error("notice-period rule has no noticeShortfallDays params");
  return p;
}

export interface NoticePlan {
  /** Either a number of days or of months, depending on the ground. */
  period: { days: number } | { months: number };
  serviceYears: number;
  earliestTermination: IsoDate;
}

export function noticePlan(serviceStart: IsoDate, noticeDate: IsoDate, workforceReduction: boolean): NoticePlan {
  const p = noticeParams();
  const notice = parseISO(noticeDate);
  const serviceYears = differenceInYears(notice, parseISO(serviceStart));
  if (workforceReduction) {
    return {
      period: { months: p.workforceReductionMonths },
      serviceYears,
      earliestTermination: format(addMonths(notice, p.workforceReductionMonths), "yyyy-MM-dd"),
    };
  }
  const tier = [...p.tiers].sort((a, b) => b.minYears - a.minYears).find((t) => serviceYears >= t.minYears);
  const days = tier?.days ?? 0;
  return { period: { days }, serviceYears, earliestTermination: format(addDays(notice, days), "yyyy-MM-dd") };
}
