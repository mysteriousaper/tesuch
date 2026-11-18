import { describe, expect, it } from "vitest";
import type { Finding } from "@/lib/rules/types";
import { planSync, type StoredFinding } from "./sync";

const finding = (o: Partial<Finding> = {}): Finding => ({
  ruleId: "probation-max", ruleVersion: 1, article: "92", sourceUrl: "https://www.arlis.am/", ruleStatus: "needs_lawyer_review",
  severity: "advisory", companyId: "co1", employeeId: "e1", contractId: "c1", dueDate: "2026-02-01", overdue: false, ...o,
});
const stored = (o: Partial<StoredFinding> = {}): StoredFinding => ({
  id: "f1", rule_id: "probation-max", rule_version: 1, employee_id: "e1", contract_id: "c1", severity: "advisory", due_date: "2026-02-01", status: "open", ...o,
});

describe("planSync", () => {
  it("inserts new findings", () => {
    const p = planSync("org", [finding()], []);
    expect(p.inserts).toEqual([expect.objectContaining({ org_id: "org", rule_id: "probation-max", contract_id: "c1" })]);
    expect(p.updates).toEqual([]);
  });
  it("does nothing when an open finding is unchanged", () => {
    expect(planSync("org", [finding()], [stored()])).toEqual({ inserts: [], updates: [], autoResolve: [] });
  });
  it("auto-resolves open findings the engine no longer produces", () => {
    expect(planSync("org", [], [stored(), stored({ id: "f2", employee_id: "e2", status: "dismissed" })]).autoResolve).toEqual(["f1"]);
  });
  it("reopens a finding marked fixed if the rule still fires", () => {
    expect(planSync("org", [finding()], [stored({ status: "fixed" })]).updates).toEqual([
      { id: "f1", rule_version: 1, severity: "advisory", due_date: "2026-02-01", status: "open", reopened: true },
    ]);
  });
  it("never touches dismissed findings", () => {
    const p = planSync("org", [finding({ ruleVersion: 2 })], [stored({ status: "dismissed" })]);
    expect(p).toEqual({ inserts: [], updates: [], autoResolve: [] });
  });
  it("refreshes version, severity and due date (e.g. rule verified by a lawyer)", () => {
    const p = planSync("org", [finding({ ruleVersion: 2, severity: "red", dueDate: "2026-03-01" })], [stored()]);
    expect(p.updates[0]).toMatchObject({ rule_version: 2, severity: "red", due_date: "2026-03-01", reopened: false });
  });
  it("matches employee-scope findings with a null contract", () => {
    const p = planSync("org", [finding({ ruleId: "annual-leave-min", contractId: null })], [stored({ rule_id: "annual-leave-min", contract_id: null })]);
    expect(p).toEqual({ inserts: [], updates: [], autoResolve: [] });
  });
});
