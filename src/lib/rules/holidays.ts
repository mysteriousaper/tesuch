// Public-holiday calendar and working-day maths. Data-driven: the calendar is a plain list of dates built from
// rules/holidays/<country>.json, so tests and callers can pass their own list.
import { addDays, format, getDay, parseISO } from "date-fns";
import { z } from "zod";
import am from "../../../rules/holidays/AM.json";
import type { IsoDate } from "./types";

const localized = z.object({ hy: z.string().min(1), ru: z.string().min(1), en: z.string().min(1) });

export const holidayFileSchema = z.object({
  country: z.string().min(2),
  /** Never "verified" until a lawyer checks the dates against arlis.am. */
  status: z.enum(["verified", "needs_verification"]),
  source_url: z.string().url(),
  source_note: z.string(),
  reviewed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  /** getDay() numbers that are weekly days off: 0 = Sunday, 6 = Saturday. */
  weekend: z.array(z.number().int().min(0).max(6)),
  /** Repeat every year. */
  fixed: z.array(z.object({ month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31), name: localized })),
  /** Extra one-off non-working dates (movable holidays, government transfers), by year. */
  by_year: z.record(z.string().regex(/^\d{4}$/), z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), name: localized }))),
});
export type HolidayFile = z.infer<typeof holidayFileSchema>;

export interface HolidayCalendar {
  /** Public holiday on this date (weekends alone do not count). */
  isHoliday(date: IsoDate): boolean;
  /** Weekly day off or public holiday. */
  isNonWorking(date: IsoDate): boolean;
  status: HolidayFile["status"];
}

const pad = (n: number) => String(n).padStart(2, "0");

export function buildCalendar(raw: unknown): HolidayCalendar {
  const file = holidayFileSchema.parse(raw);
  const fixed = new Set(file.fixed.map((h) => `${pad(h.month)}-${pad(h.day)}`));
  const extra = new Set(Object.values(file.by_year).flatMap((list) => list.map((h) => h.date)));
  const weekend = new Set(file.weekend);
  const isHoliday = (date: IsoDate) => fixed.has(date.slice(5)) || extra.has(date);
  return {
    isHoliday,
    isNonWorking: (date) => weekend.has(getDay(parseISO(date))) || isHoliday(date),
    status: file.status,
  };
}

/** Armenian calendar from rules/holidays/AM.json (status: needs_verification). */
export const AM_CALENDAR: HolidayCalendar = buildCalendar(am);

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export const isWorkingDay = (date: IsoDate, cal: HolidayCalendar = AM_CALENDAR) => !cal.isNonWorking(date);

/** The date itself if it is a working day, else the next working day. */
export function nextWorkingDay(date: IsoDate, cal: HolidayCalendar = AM_CALENDAR): IsoDate {
  let d = parseISO(date);
  while (cal.isNonWorking(iso(d))) d = addDays(d, 1);
  return iso(d);
}

/** Moves `n` working days forward (or back when n < 0). n = 0 returns the date unchanged. Year boundaries are fine. */
export function addWorkingDays(date: IsoDate, n: number, cal: HolidayCalendar = AM_CALENDAR): IsoDate {
  const step = n < 0 ? -1 : 1;
  let d = parseISO(date);
  for (let left = Math.abs(n); left > 0; ) {
    d = addDays(d, step);
    if (!cal.isNonWorking(iso(d))) left--;
  }
  return iso(d);
}
