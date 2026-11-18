import { addDays, format, parseISO } from "date-fns";
import { Almanac, Engine } from "json-rules-engine";
import { baseFacts, isActive, paramFacts, type RuleContext } from "./facts";
import type { RuleDefinition } from "./schema";
import type { Contract, EffectiveSeverity, Employee, Finding, IsoDate, LeaveRecord } from "./types";

export interface CompanyData {
  employees: Employee[];
  contracts: Contract[];
  leave: LeaveRecord[];
}

export function effectiveSeverity(rule: RuleDefinition): EffectiveSeverity {
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

function dueDate(rule: RuleDefinition, ctx: RuleContext): IsoDate {
  const anchor =
    rule.due.date === "probationEnd"
      ? ctx.contract.probationEnd
      : rule.due.date === "contractEnd"
        ? ctx.contract.endDate
        : ctx.asOf;
  return format(addDays(parseISO(anchor ?? ctx.asOf), rule.due.offsetDays), "yyyy-MM-dd");
}

/** The contract employee-scope rules are evaluated against: latest active, else latest started. */
export function primaryContract(contracts: Contract[], asOf: IsoDate): Contract | undefined {
  const byStartDesc = [...contracts].sort((a, b) => b.startDate.localeCompare(a.startDate));
  return byStartDesc.find((c) => isActive(c, asOf)) ?? byStartDesc[0];
}

/** Deterministic: same rules + data + asOf always produce the same findings. */
export async function evaluateCompany(rules: RuleDefinition[], data: CompanyData, asOf: IsoDate): Promise<Finding[]> {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const contractEngine = buildEngine(rules.filter((r) => r.scope === "contract"));
  const employeeEngine = buildEngine(rules.filter((r) => r.scope === "employee"));
  const findings: Finding[] = [];

  const run = async (engine: Engine, ctx: RuleContext, contractId: string | null) => {
    const { events } = await engine.run({ ctx, ...baseFacts(ctx) });
    for (const ev of events) {
      const rule = byId.get(ev.type)!;
      const due = dueDate(rule, ctx);
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
      await run(contractEngine, { asOf, employee, contract, contracts, leave }, contract.id);
    }
    const primary = primaryContract(contracts, asOf);
    if (primary) await run(employeeEngine, { asOf, employee, contract: primary, contracts, leave }, null);
  }

  return findings.sort(
    (a, b) => a.employeeId.localeCompare(b.employeeId) || a.ruleId.localeCompare(b.ruleId) || (a.contractId ?? "").localeCompare(b.contractId ?? ""),
  );
}
