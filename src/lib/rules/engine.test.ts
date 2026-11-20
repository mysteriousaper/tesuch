import { describe, expect, it } from "vitest";
import { parseRules, RULES } from "./catalog";
import { effectiveSeverity, evaluateCompany, evaluateCompanyDetailed } from "./engine";
import { planSync } from "../jobs/sync";
import { probationOverrunDays } from "./facts";
import { firmScore, inspectionReadyScore, scoreFrom } from "./score";
import type { Contract, Employee, LeaveRecord } from "./types";

const emp = (o: Partial<Employee> = {}): Employee => ({
  id: "e1", companyId: "co1", birthDate: "1990-05-10", sixDayWeek: false, ...o,
});
const con = (o: Partial<Contract> = {}): Contract => ({
  id: "c1", employeeId: "e1", type: "indefinite", startDate: "2026-01-15", endDate: null,
  probationEnd: null, probationSpecialCase: false, hiredByTransfer: false, fixedTermGround: null,
  srcRegistered: true, terminatedOn: null, terminationGround: null, terminationInitiator: null,
  noticeGivenOn: null, workforceReduction: false, ...o,
});
const leave = (o: Partial<LeaveRecord>): LeaveRecord => ({
  id: "l1", employeeId: "e1", type: "annual", startDate: "2026-07-01", days: 20, ...o,
});

async function ruleIds(opts: { e?: Partial<Employee>; c?: Partial<Contract>; l?: Partial<LeaveRecord>[]; asOf?: string }) {
  const findings = await evaluateCompany(
    RULES,
    { employees: [emp(opts.e)], contracts: [con(opts.c)], leave: (opts.l ?? []).map((l, i) => leave({ id: `l${i}`, ...l })) },
    opts.asOf ?? "2026-02-01",
  );
  return findings.map((f) => f.ruleId);
}

describe("catalog", () => {
  it("loads every rule, all unverified until a lawyer signs off", () => {
    expect(RULES).toHaveLength(12);
    for (const r of RULES) expect(r.status).toBe("needs_lawyer_review");
  });
  it("rejects a verified rule without an article", () => {
    expect(() => parseRules([{ ...RULES[0], status: "verified", article: null }])).toThrow(/article/);
  });
  it("rejects duplicate ids", () => {
    expect(() => parseRules([RULES[0], RULES[0]])).toThrow(/Duplicate/);
  });
  it("rejects sources outside arlis.am", () => {
    expect(() => parseRules([{ ...RULES[0], source_url: "https://example.com/" }])).toThrow();
  });
});

describe("severity and citations", () => {
  it("unverified red rules surface as advisory, with article and arlis link", async () => {
    const [f] = await evaluateCompany(RULES, { employees: [emp({ birthDate: "2010-01-01" })], contracts: [con({ probationEnd: "2026-03-01" })], leave: [] }, "2026-02-01");
    expect(f).toMatchObject({ ruleId: "probation-minor", severity: "advisory", article: "91", ruleStatus: "needs_lawyer_review" });
    expect(f.sourceUrl).toMatch(/^https:\/\/www\.arlis\.am\//);
  });
  it("verified rules keep their own severity", async () => {
    const verified = RULES.map((r) => (r.id === "probation-minor" ? { ...r, status: "verified" as const } : r));
    const [f] = await evaluateCompany(verified, { employees: [emp({ birthDate: "2010-01-01" })], contracts: [con({ probationEnd: "2026-03-01" })], leave: [] }, "2026-02-01");
    expect(f.severity).toBe("red");
  });
});

describe("probation-minor (Art. 91)", () => {
  it("fires for a 17-year-old on probation", async () => {
    expect(await ruleIds({ e: { birthDate: "2008-06-01" }, c: { probationEnd: "2026-03-01" } })).toContain("probation-minor");
  });
  it("does not fire on the 18th birthday", async () => {
    expect(await ruleIds({ e: { birthDate: "2008-01-15" }, c: { probationEnd: "2026-03-01" } })).not.toContain("probation-minor");
  });
  it("fires the day before the 18th birthday", async () => {
    expect(await ruleIds({ e: { birthDate: "2008-01-16" }, c: { probationEnd: "2026-03-01" } })).toContain("probation-minor");
  });
  it("does not fire when birth date is unknown", async () => {
    expect(await ruleIds({ e: { birthDate: null }, c: { probationEnd: "2026-03-01" } })).not.toContain("probation-minor");
  });
  it("does not fire without probation", async () => {
    expect(await ruleIds({ e: { birthDate: "2010-01-01" } })).not.toContain("probation-minor");
  });
});

describe("probation-transfer (Art. 91)", () => {
  it("fires when a transferred employee has probation", async () => {
    expect(await ruleIds({ c: { hiredByTransfer: true, probationEnd: "2026-03-01" } })).toContain("probation-transfer");
  });
  it("does not fire without probation", async () => {
    expect(await ruleIds({ c: { hiredByTransfer: true } })).not.toContain("probation-transfer");
  });
});

describe("probation-max (Art. 92)", () => {
  it("allows exactly 3 months (last day = start + 3 months - 1)", async () => {
    expect(await ruleIds({ c: { probationEnd: "2026-04-14" } })).not.toContain("probation-max");
  });
  it("flags one day over", async () => {
    expect(await ruleIds({ c: { probationEnd: "2026-04-15" } })).toContain("probation-max");
  });
  it("clamps month-end starts", () => {
    expect(probationOverrunDays(con({ startDate: "2026-01-31", probationEnd: "2026-04-29" }), 3)).toBe(0);
    expect(probationOverrunDays(con({ startDate: "2026-01-31", probationEnd: "2026-04-30" }), 3)).toBe(1);
  });
  it("handles leap years (30 Nov 2027 + 3 months = 29 Feb 2028)", () => {
    expect(probationOverrunDays(con({ startDate: "2027-11-30", probationEnd: "2028-02-28" }), 3)).toBe(0);
    expect(probationOverrunDays(con({ startDate: "2027-11-30", probationEnd: "2028-02-29" }), 3)).toBe(1);
  });
  it("allows up to 12 months in special cases", async () => {
    expect(await ruleIds({ c: { probationSpecialCase: true, probationEnd: "2027-01-14" } })).not.toContain("probation-max");
    expect(await ruleIds({ c: { probationSpecialCase: true, probationEnd: "2027-01-15" } })).toContain("probation-max");
  });
});

describe("probation-ending (Art. 93)", () => {
  it("reminds 14 days ahead with due date 3 days before the end", async () => {
    const f = await evaluateCompany(RULES, { employees: [emp()], contracts: [con({ probationEnd: "2026-04-14" })], leave: [] }, "2026-03-31");
    expect(f.find((x) => x.ruleId === "probation-ending")?.dueDate).toBe("2026-04-11");
  });
  it("is silent 15 days ahead and after the end", async () => {
    expect(await ruleIds({ c: { probationEnd: "2026-04-14" }, asOf: "2026-03-30" })).not.toContain("probation-ending");
    expect(await ruleIds({ c: { probationEnd: "2026-04-14" }, asOf: "2026-04-15" })).not.toContain("probation-ending");
  });
});

describe("fixed-term rules (Art. 95)", () => {
  it("flags a fixed-term contract with no ground, including whitespace-only", async () => {
    expect(await ruleIds({ c: { type: "fixed_term", endDate: "2026-12-31", fixedTermGround: "" } })).toContain("fixed-term-ground");
    expect(await ruleIds({ c: { type: "fixed_term", endDate: "2026-12-31", fixedTermGround: "  " } })).toContain("fixed-term-ground");
    expect(await ruleIds({ c: { type: "fixed_term", endDate: "2026-12-31", fixedTermGround: "seasonal work" } })).not.toContain("fixed-term-ground");
  });
  it("skips an unknown ground (null): the file did not carry it", async () => {
    expect(await ruleIds({ c: { type: "fixed_term", endDate: "2026-12-31", fixedTermGround: null } })).not.toContain("fixed-term-ground");
  });
  it("alerts 30 days before the end, not 31, and on the last day", async () => {
    const c = { type: "fixed_term" as const, endDate: "2026-03-03", fixedTermGround: "x" };
    expect(await ruleIds({ c, asOf: "2026-02-01" })).toContain("fixed-term-ending");
    expect(await ruleIds({ c, asOf: "2026-01-31" })).not.toContain("fixed-term-ending");
    expect(await ruleIds({ c, asOf: "2026-03-03" })).toContain("fixed-term-ending");
    expect(await ruleIds({ c, asOf: "2026-03-04" })).not.toContain("fixed-term-ending");
  });
});

describe("termination-ground (Art. 113)", () => {
  it("flags a past termination with no ground", async () => {
    expect(await ruleIds({ c: { terminatedOn: "2026-01-31", terminationInitiator: "employee" } })).toContain("termination-ground");
  });
  it("ignores a termination scheduled in the future", async () => {
    expect(await ruleIds({ c: { terminatedOn: "2026-02-02", terminationInitiator: "employee" } })).not.toContain("termination-ground");
  });
});

describe("annual-leave-min", () => {
  it("skips employees with no leave records at all (data not provided)", async () => {
    const c = { startDate: "2025-01-15" };
    expect(await ruleIds({ c, asOf: "2026-02-01", l: [] })).not.toContain("annual-leave-min");
  });
  const c = { startDate: "2025-01-15" };
  it("is silent before a full working year", async () => {
    expect(await ruleIds({ c, asOf: "2026-01-14" })).not.toContain("annual-leave-min");
  });
  it("flags fewer than 20 days on a five-day week", async () => {
    expect(await ruleIds({ c, l: [{ startDate: "2025-07-01", days: 19 }] })).toContain("annual-leave-min");
    expect(await ruleIds({ c, l: [{ startDate: "2025-07-01", days: 20 }] })).not.toContain("annual-leave-min");
  });
  it("requires 24 days on a six-day week", async () => {
    expect(await ruleIds({ c, e: { sixDayWeek: true }, l: [{ startDate: "2025-07-01", days: 20 }] })).toContain("annual-leave-min");
    expect(await ruleIds({ c, e: { sixDayWeek: true }, l: [{ startDate: "2025-07-01", days: 24 }] })).not.toContain("annual-leave-min");
  });
  it("counts only leave inside the last completed working year", async () => {
    expect(await ruleIds({ c, l: [{ startDate: "2026-01-15", days: 20 }] })).toContain("annual-leave-min");
  });
  it("counts service from the first contract with the employer", async () => {
    const findings = await evaluateCompany(RULES, {
      employees: [emp()],
      contracts: [con({ id: "old", startDate: "2024-03-01", terminatedOn: "2025-12-31", terminationGround: "x", terminationInitiator: "mutual" }), con({ id: "new", startDate: "2026-01-01" })],
      leave: [leave({ startDate: "2024-06-01", days: 5 })],
    }, "2026-02-01");
    expect(findings.map((f) => f.ruleId)).toContain("annual-leave-min");
  });
});

describe("leave-cash-swap", () => {
  it("flags cash compensation for an active employee", async () => {
    expect(await ruleIds({ l: [{ type: "cash_compensation" }] })).toContain("leave-cash-swap");
  });
  it("allows it on termination", async () => {
    expect(await ruleIds({ c: { terminatedOn: "2026-01-31", terminationGround: "x", terminationInitiator: "employee" }, l: [{ type: "cash_compensation" }] })).not.toContain("leave-cash-swap");
  });
});

describe("notice-period", () => {
  const term = (o: Partial<Contract>) => ({ terminationInitiator: "employer" as const, terminationGround: "x", ...o });
  it("needs 14 days under 1 year of service", async () => {
    expect(await ruleIds({ c: term({ noticeGivenOn: "2026-01-01", terminatedOn: "2026-01-15" }) })).not.toContain("notice-period");
    expect(await ruleIds({ c: term({ noticeGivenOn: "2026-01-02", terminatedOn: "2026-01-15" }) })).toContain("notice-period");
  });
  it("needs 35 days from 1 year of service", async () => {
    const c = term({ startDate: "2024-12-01", noticeGivenOn: "2025-12-01", terminatedOn: "2026-01-04" });
    expect(await ruleIds({ c })).toContain("notice-period");
    expect(await ruleIds({ c: { ...c, terminatedOn: "2026-01-05" } })).not.toContain("notice-period");
  });
  it("needs 60 days from 15 years", async () => {
    const c = term({ startDate: "2010-01-01", noticeGivenOn: "2025-11-01", terminatedOn: "2025-12-30" });
    expect(await ruleIds({ c })).toContain("notice-period");
    expect(await ruleIds({ c: { ...c, terminatedOn: "2025-12-31" } })).not.toContain("notice-period");
  });
  it("needs 2 months for workforce reduction", async () => {
    const c = term({ workforceReduction: true, startDate: "2025-06-01", noticeGivenOn: "2025-11-30", terminatedOn: "2026-01-29" });
    expect(await ruleIds({ c })).toContain("notice-period");
    expect(await ruleIds({ c: { ...c, terminatedOn: "2026-01-30" } })).not.toContain("notice-period");
  });
  it("treats a missing notice date as no notice", async () => {
    expect(await ruleIds({ c: term({ terminatedOn: "2026-01-31" }) })).toContain("notice-period");
  });
  it("ignores resignations", async () => {
    expect(await ruleIds({ c: term({ terminationInitiator: "employee", terminatedOn: "2026-01-31" }) })).not.toContain("notice-period");
  });
});

describe("maternity-min and src-registration", () => {
  it("flags maternity leave under 140 days", async () => {
    expect(await ruleIds({ l: [{ type: "maternity", days: 139 }] })).toContain("maternity-min");
    expect(await ruleIds({ l: [{ type: "maternity", days: 140 }] })).not.toContain("maternity-min");
  });
  it("flags active contracts not registered with SRC", async () => {
    expect(await ruleIds({ c: { srcRegistered: false } })).toContain("src-registration");
  });
  it("skips unknown SRC status (null) and registered contracts", async () => {
    expect(await ruleIds({ c: { srcRegistered: null } })).not.toContain("src-registration");
    expect(await ruleIds({ c: { srcRegistered: true } })).not.toContain("src-registration");
  });
});

describe("effectiveSeverity", () => {
  const base = RULES[0];
  it("downgrades unverified red/amber to advisory", () => {
    expect(effectiveSeverity({ ...base, status: "needs_lawyer_review", severity: "red" })).toBe("advisory");
    expect(effectiveSeverity({ ...base, status: "needs_lawyer_review", severity: "amber" })).toBe("advisory");
  });
  it("keeps info as info whatever the status", () => {
    expect(effectiveSeverity({ ...base, status: "needs_lawyer_review", severity: "info" })).toBe("info");
    expect(effectiveSeverity({ ...base, status: "verified", severity: "info" })).toBe("info");
  });
  it("keeps verified severity", () => {
    expect(effectiveSeverity({ ...base, status: "verified", severity: "red" })).toBe("red");
  });
});

describe("determinism and score", () => {
  it("a clean employee has no findings and scores 100", async () => {
    const f = await evaluateCompany(RULES, { employees: [emp()], contracts: [con()], leave: [] }, "2026-02-01");
    expect(f).toEqual([]);
    expect(inspectionReadyScore(f)).toBe(100);
  });
  it("same input gives the same output", async () => {
    const data = { employees: [emp({ birthDate: "2010-01-01" })], contracts: [con({ probationEnd: "2026-05-01", srcRegistered: false })], leave: [] };
    expect(await evaluateCompany(RULES, data, "2026-02-01")).toEqual(await evaluateCompany(RULES, data, "2026-02-01"));
  });
  it("scores penalties, doubles overdue and clamps at 0", () => {
    expect(inspectionReadyScore([{ severity: "advisory", overdue: false }, { severity: "red", overdue: true }])).toBe(56);
    expect(inspectionReadyScore(Array(10).fill({ severity: "red", overdue: false }))).toBe(0);
  });
  it("an open scoring finding caps the score at 99; info never scores", () => {
    expect(inspectionReadyScore([{ severity: "info", overdue: true }])).toBe(100);
    expect(scoreFrom(0, true)).toBe(99);
    expect(scoreFrom(0, false)).toBe(100);
    expect(inspectionReadyScore([{ severity: "advisory", overdue: false }])).toBeLessThanOrEqual(99);
  });
  it("firm score skips companies without data", () => {
    expect(firmScore([80, null, 60])).toBe(70);
    expect(firmScore([null, null])).toBeNull();
  });
  it("firm score is the mean of companies", () => {
    expect(firmScore([100, 50, 75])).toBe(75);
    expect(firmScore([])).toBeNull();
  });
});

describe("unknown input is skipped, never resolved", () => {
  const fixedTerm = { type: "fixed_term" as const, endDate: "2026-12-31" };
  const storedOpen = (ruleId: string, contractId: string | null) => ({
    id: "f1", rule_id: ruleId, rule_version: 2, employee_id: "e1", contract_id: contractId,
    severity: "advisory" as const, due_date: "2026-02-01", status: "open" as const,
  });

  it("blank manual ground (empty string) fires; unknown ground (null) is reported skipped", async () => {
    const blank = await evaluateCompanyDetailed(RULES, { employees: [emp()], contracts: [con({ ...fixedTerm, fixedTermGround: "" })], leave: [] }, "2026-02-01");
    expect(blank.findings.map((f) => f.ruleId)).toContain("fixed-term-ground");
    expect(blank.skipped).not.toContain("fixed-term-ground|e1|c1");
    const unknown = await evaluateCompanyDetailed(RULES, { employees: [emp()], contracts: [con({ ...fixedTerm, fixedTermGround: null })], leave: [] }, "2026-02-01");
    expect(unknown.findings.map((f) => f.ruleId)).not.toContain("fixed-term-ground");
    expect(unknown.skipped).toContain("fixed-term-ground|e1|c1");
  });
  it("an open finding survives sync when its input became unknown, but resolves when the ground is given", async () => {
    const open = storedOpen("fixed-term-ground", "c1");
    const unknown = await evaluateCompanyDetailed(RULES, { employees: [emp()], contracts: [con({ ...fixedTerm, fixedTermGround: null })], leave: [] }, "2026-02-01");
    expect(planSync("org", unknown.findings, [open], unknown.skipped).autoResolve).toEqual([]);
    const fixed = await evaluateCompanyDetailed(RULES, { employees: [emp()], contracts: [con({ ...fixedTerm, fixedTermGround: "seasonal" })], leave: [] }, "2026-02-01");
    expect(planSync("org", fixed.findings, [open], fixed.skipped).autoResolve).toEqual(["f1"]);
  });
  it("leave is company-level: no leave anywhere skips, any leave checks employees with none", async () => {
    const c = (id: string, employeeId: string) => con({ id, employeeId, startDate: "2025-01-15" });
    const base = { employees: [emp(), emp({ id: "e2" })], contracts: [c("c1", "e1"), c("c2", "e2")] };
    const none = await evaluateCompanyDetailed(RULES, { ...base, leave: [] }, "2026-02-01");
    expect(none.findings.map((f) => f.ruleId)).not.toContain("annual-leave-min");
    expect(none.skipped).toEqual(expect.arrayContaining(["annual-leave-min|e1|", "annual-leave-min|e2|"]));
    expect(planSync("org", none.findings, [storedOpen("annual-leave-min", null)], none.skipped).autoResolve).toEqual([]);
    const some = await evaluateCompanyDetailed(RULES, { ...base, leave: [leave({ employeeId: "e1", startDate: "2025-07-01", days: 20 })] }, "2026-02-01");
    const hits = some.findings.filter((f) => f.ruleId === "annual-leave-min").map((f) => f.employeeId);
    expect(hits).toEqual(["e2"]);
    expect(some.skipped).not.toContain("annual-leave-min|e2|");
  });
});
