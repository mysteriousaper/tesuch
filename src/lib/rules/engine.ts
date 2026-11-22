import { addDays, format, parseISO } from "date-fns";
import { Almanac, Engine } from "json-rules-engine";
import { addWorkingDays, AM_CALENDAR, nextWorkingDay, type HolidayCalendar } from "./holidays";
import { baseFacts, isActive, paramFacts, type RuleContext } from "./facts";
import type { RuleDefinition } from "./schema";
import type { Contract, EffectiveSeverity, Employee, Finding, IsoDate, LeaveRecord } from "./types";

export interface CompanyData {
  employees: Employee[];
  contracts: Contract[];
  leave: LeaveRecord[];
}

export function effectiveSeverity(rule: RuleDefinition): EffectiveSeverity {
  // Unverified rules downgrade red/amber to advisory only; info stays info (0 points, no alert).
  if (rule.severity === "info") return "info";
  return rule.status === "verified" ? rule.severity : "advisory";
}

function buildEngine(rules: RuleDefinition[]): Engine {
  const engine = new Engine([], { allowUndefinedFacts: false });
  for (const [name, fn] of Object.entries(paramFacts)) {
    engine.addFact(name, async (params: Record<string, unknown>, almanac: Almanac) =>
      fn((await almanac.factValue("ctx")) as RuleContext, params),
    );
  }
  for (const rule of rules) {
    engine.addRule({
      name: rule.id,
      conditions: rule.conditions as never,
      event: { type: rule.id },
    });
  }
  return engine;
}

function dueDate(rule: RuleDefinition, ctx: RuleContext, calendar: HolidayCalendar): IsoDate {
  const anchor =
    rule.due.date === "probationEnd"
      ? ctx.contract.probationEnd
      : rule.due.date === "contractEnd"
        ? ctx.contract.endDate
        : ctx.asOf;
  const from = anchor ?? ctx.asOf;
  const due = rule.due.unit === "working" ? addWorkingDays(from, rule.due.offsetDays, calendar) : format(addDays(parseISO(from), rule.due.offsetDays), "yyyy-MM-dd");
  return rule.due.moveToWorkingDay ? nextWorkingDay(due, calendar) : due;
}

/** The contract employee-scope rules are evaluated against: latest active, else latest started. */
export function primaryContract(contracts: Contract[], asOf: IsoDate): Contract | undefined {
  const byStartDesc = [...contracts].sort((a, b) => b.startDate.localeCompare(a.startDate));
  return byStartDesc.find((c) => isActive(c, asOf)) ?? byStartDesc[0];
}

/** Guard facts that mean "input unknown": a rule failing only on one of these is skipped, not satisfied. */
const UNKNOWN_GUARDS = new Set(["fixedTermGroundKnown", "srcRegisteredKnown", "hasLeaveRecords"]);

/** A rule that stops firing because another rule took over: its open finding must not auto-resolve (key: superseded, value: successor rule). */
const SUPERSEDED_BY: Record<string, string> = { "fixed-term-ending": "fixed-term-expired" };

export interface Evaluation {
  findings: Finding[];
  /** Keys `rule|employee|contract` of rules that did not fire because an input was unknown; sync must not auto-resolve them. */
  skipped: string[];
}

export const findingKey = (ruleId: string, employeeId: string, contractId: string | null) => `${ruleId}|${employeeId}|${contractId ?? ""}`;

function guardFacts(rule: RuleDefinition): string[] {
  const all = (rule.conditions as { all?: { fact?: string }[] }).all ?? [];
  return all.map((c) => c.fact ?? "").filter((f) => UNKNOWN_GUARDS.has(f));
}

/** Deterministic: same rules + data + asOf always produce the same findings. */
export async function evaluateCompany(rules: RuleDefinition[], data: CompanyData, asOf: IsoDate, calendar: HolidayCalendar = AM_CALENDAR): Promise<Finding[]> {
  return (await evaluateCompanyDetailed(rules, data, asOf, calendar)).findings;
}

export async function evaluateCompanyDetailed(rules: RuleDefinition[], data: CompanyData, asOf: IsoDate, calendar: HolidayCalendar = AM_CALENDAR): Promise<Evaluation> {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const contractRulesList = rules.filter((r) => r.scope === "contract");
  const employeeRulesList = rules.filter((r) => r.scope === "employee");
  const contractEngine = buildEngine(contractRulesList);
  const employeeEngine = buildEngine(employeeRulesList);
  const findings: Finding[] = [];
  const skipped = new Set<string>();
  const companyHasLeave = data.leave.length > 0;

  const run = async (engine: Engine, scopeRules: RuleDefinition[], ctx: RuleContext, contractId: string | null) => {
    const facts = baseFacts(ctx);
    const { events } = await engine.run({ ctx, ...facts });
    const fired = new Set(events.map((ev) => ev.type));
    for (const rule of scopeRules) {
      if (!fired.has(rule.id) && guardFacts(rule).some((g) => facts[g] === false)) {
        skipped.add(findingKey(rule.id, ctx.employee.id, contractId));
      }
      const next = SUPERSEDED_BY[rule.id];
      if (!fired.has(rule.id) && next && fired.has(next)) skipped.add(findingKey(rule.id, ctx.employee.id, contractId));
    }
    for (const ev of events) {
      const rule = byId.get(ev.type)!;
      const due = dueDate(rule, ctx, calendar);
      findings.push({
        ruleId: rule.id,
        ruleVersion: rule.version,
        article: rule.article,
        sourceUrl: rule.source_url,
        ruleStatus: rule.status,
        severity: effectiveSeverity(rule),
        companyId: ctx.employee.companyId,
        employeeId: ctx.employee.id,
        contractId,
        dueDate: due,
        overdue: due < asOf,
      });
    }
  };

  for (const employee of data.employees) {
    const contracts = data.contracts.filter((c) => c.employeeId === employee.id);
    const leave = data.leave.filter((l) => l.employeeId === employee.id);
    for (const contract of contracts) {
      await run(contractEngine, contractRulesList, { asOf, employee, contract, contracts, leave, companyHasLeave }, contract.id);
    }
    const primary = primaryContract(contracts, asOf);
    if (primary) await run(employeeEngine, employeeRulesList, { asOf, employee, contract: primary, contracts, leave, companyHasLeave }, null);
  }

  findings.sort(
    (a, b) => a.employeeId.localeCompare(b.employeeId) || a.ruleId.localeCompare(b.ruleId) || (a.contractId ?? "").localeCompare(b.contractId ?? ""),
  );
  return { findings, skipped: [...skipped].sort() };
}
