import { describe, expect, it } from "vitest";
import { RULES } from "../../../lib/rules/catalog";
import { evaluateCompany } from "../../../lib/rules/engine";
import type { Contract, Employee, LeaveRecord } from "../../../lib/rules/types";
import { generateDemoCompanies } from "./demo-data";

const AS_OF = "2026-11-18";

async function evaluateAll(seed: number) {
  const companies = generateDemoCompanies(AS_OF, seed);
  const ids = new Set<string>();
  let total = 0;
  for (const [ci, co] of companies.entries()) {
    const employees: Employee[] = [];
    const contracts: Contract[] = [];
    const leave: LeaveRecord[] = [];
    co.employees.forEach((e, k) => {
      const id = `e${ci}-${k}`;
      employees.push({ id, companyId: `c${ci}`, birthDate: e.birthDate, sixDayWeek: e.sixDayWeek });
      const c = e.contract;
      contracts.push({
        id: `k${ci}-${k}`, employeeId: id, type: c.type, startDate: c.start_date, endDate: c.end_date, probationEnd: c.probation_end,
        probationSpecialCase: c.probation_special_case, hiredByTransfer: c.hired_by_transfer, fixedTermGround: c.fixed_term_ground,
        srcRegistered: c.src_registered, terminatedOn: c.terminated_on, terminationGround: c.termination_ground,
        terminationInitiator: c.termination_initiator, noticeGivenOn: c.notice_given_on, workforceReduction: c.workforce_reduction,
      });
      e.leave.forEach((l, i) => leave.push({ id: `l${ci}-${k}-${i}`, employeeId: id, type: l.type, startDate: l.start_date, days: l.days }));
    });
    const findings = await evaluateCompany(RULES, { employees, contracts, leave }, AS_OF);
    findings.forEach((f) => ids.add(f.ruleId));
    total += findings.length;
  }
  return { companies, ids, total };
}

describe("demo data", () => {
  it("creates 5 fictional companies with 8 employees each", () => {
    const companies = generateDemoCompanies(AS_OF, 1);
    expect(companies).toHaveLength(5);
    for (const c of companies) {
      expect(c.name).toMatch(/^Դեմո .+ ՍՊԸ$/);
      expect(c.employees).toHaveLength(8);
    }
  });

  it("produces a realistic spread of findings across rules", async () => {
    const { ids, total } = await evaluateAll(42);
    for (const rule of ["probation-minor", "probation-max", "probation-ending", "fixed-term-ending", "fixed-term-ground", "src-registration", "annual-leave-min", "notice-period"]) {
      expect(ids, rule).toContain(rule);
    }
    // Most people are compliant: well under one finding per employee.
    expect(total).toBeLessThan(40);
  });

  it("is deterministic for a seed and valid for the database checks", () => {
    expect(generateDemoCompanies(AS_OF, 7)).toEqual(generateDemoCompanies(AS_OF, 7));
    for (const c of generateDemoCompanies(AS_OF, 7)) {
      for (const e of c.employees) {
        const k = e.contract;
        if (k.type !== "fixed_term") expect(k.end_date).toBeNull();
        if (k.end_date) expect(k.end_date >= k.start_date).toBe(true);
        if (k.probation_end) expect(k.probation_end >= k.start_date).toBe(true);
      }
    }
  });
});
