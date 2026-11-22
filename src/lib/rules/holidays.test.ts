import { describe, expect, it } from "vitest";
import { RULES } from "./catalog";
import { evaluateCompany } from "./engine";
import { addWorkingDays, AM_CALENDAR, buildCalendar, isWorkingDay, nextWorkingDay } from "./holidays";
import type { Contract, Employee } from "./types";

const emp: Employee = { id: "e1", companyId: "co1", birthDate: "1990-05-10", sixDayWeek: false };
const con: Contract = {
  id: "c1", employeeId: "e1", type: "indefinite", startDate: "2026-01-15", endDate: null, probationEnd: "2026-04-17",
  probationSpecialCase: false, hiredByTransfer: false, fixedTermGround: null, srcRegistered: true, terminatedOn: null,
  terminationGround: null, terminationInitiator: null, noticeGivenOn: null, workforceReduction: false,
};

describe("Armenian calendar file", () => {
  it("is flagged for verification and has no invented movable dates", () => {
    expect(AM_CALENDAR.status).toBe("needs_verification");
    expect(AM_CALENDAR.isHoliday("2026-01-01")).toBe(true);
    expect(AM_CALENDAR.isHoliday("2030-09-21")).toBe(true); // fixed dates repeat every year
    expect(AM_CALENDAR.isHoliday("2026-09-22")).toBe(false);
  });
});

describe("working days", () => {
  it("weekends and holidays are not working days", () => {
    expect(isWorkingDay("2026-11-20")).toBe(true); // Friday
    expect(isWorkingDay("2026-11-21")).toBe(false); // Saturday
    expect(isWorkingDay("2026-11-22")).toBe(false); // Sunday
    expect(isWorkingDay("2026-05-28")).toBe(false); // Republic Day, Thursday
  });
  it("skips a weekend", () => {
    expect(addWorkingDays("2026-11-20", 1)).toBe("2026-11-23");
    expect(addWorkingDays("2026-11-20", 0)).toBe("2026-11-20");
    expect(addWorkingDays("2026-11-23", -1)).toBe("2026-11-20");
  });
  it("skips a holiday in the middle of the week", () => {
    expect(addWorkingDays("2026-05-27", 1)).toBe("2026-05-29");
  });
  it("crosses the year boundary: 31 Dec 2026 + 1 working day skips 1-2 Jan and the weekend", () => {
    expect(addWorkingDays("2026-12-31", 1)).toBe("2027-01-04");
    expect(addWorkingDays("2027-01-04", -1)).toBe("2026-12-31");
  });
  it("crosses the year boundary the other way: 31 Dec 2025 + 1 working day = Mon 5 Jan 2026", () => {
    expect(addWorkingDays("2025-12-31", 1)).toBe("2026-01-05");
    expect(addWorkingDays("2025-12-31", 2)).toBe("2026-01-07"); // Tue 6 Jan is Christmas
  });
  it("nextWorkingDay keeps a working day and moves a day off", () => {
    expect(nextWorkingDay("2026-11-20")).toBe("2026-11-20");
    expect(nextWorkingDay("2026-11-21")).toBe("2026-11-23");
    expect(nextWorkingDay("2027-01-01")).toBe("2027-01-04");
  });
  it("accepts any data-driven list, including one-off dates", () => {
    const cal = buildCalendar({
      country: "XX", status: "verified", source_url: "https://example.com/", source_note: "", reviewed_on: "2026-01-01", weekend: [0],
      fixed: [], by_year: { "2026": [{ date: "2026-11-23", name: { hy: "x", ru: "x", en: "x" } }] },
    });
    expect(addWorkingDays("2026-11-20", 1, cal)).toBe("2026-11-21"); // Saturday works here
    expect(addWorkingDays("2026-11-21", 1, cal)).toBe("2026-11-24"); // Sunday off, 23rd is a one-off holiday
  });
});

describe("due dates in the engine", () => {
  const base = RULES.find((r) => r.id === "probation-ending")!;
  const due = async (due: Partial<typeof base.due>) => {
    const rule = { ...base, due: { ...base.due, ...due } };
    const [f] = await evaluateCompany([rule], { employees: [emp], contracts: [con], leave: [] }, "2026-04-10");
    return f?.dueDate;
  };
  it("default stays in calendar days, even on a weekend (no behaviour change)", async () => {
    expect(await due({ date: "probationEnd", offsetDays: 1 })).toBe("2026-04-18"); // Saturday
  });
  it("moveToWorkingDay moves a Saturday due date to Monday", async () => {
    expect(await due({ date: "probationEnd", offsetDays: 1, moveToWorkingDay: true })).toBe("2026-04-20");
  });
  it("unit working counts working days", async () => {
    expect(await due({ date: "probationEnd", offsetDays: 2, unit: "working" })).toBe("2026-04-21"); // Fri 17 → Mon 20, Tue 21
  });
});
