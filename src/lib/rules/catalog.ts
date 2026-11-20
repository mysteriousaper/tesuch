// Static imports so the catalog works in serverless and edge runtimes without fs access.
import annualLeaveMin from "../../../rules/annual-leave-min.json";
import fixedTermEnding from "../../../rules/fixed-term-ending.json";
import fixedTermExpired from "../../../rules/fixed-term-expired.json";
import fixedTermGround from "../../../rules/fixed-term-ground.json";
import leaveCashSwap from "../../../rules/leave-cash-swap.json";
import maternityMin from "../../../rules/maternity-min.json";
import noticePeriod from "../../../rules/notice-period.json";
import probationEnding from "../../../rules/probation-ending.json";
import probationMax from "../../../rules/probation-max.json";
import probationMinor from "../../../rules/probation-minor.json";
import probationTransfer from "../../../rules/probation-transfer.json";
import srcRegistration from "../../../rules/src-registration.json";
import terminationGround from "../../../rules/termination-ground.json";
import { ruleSchema, type RuleDefinition } from "./schema";

const RAW = [
  probationMinor,
  probationTransfer,
  probationMax,
  probationEnding,
  fixedTermGround,
  fixedTermEnding,
  fixedTermExpired,
  terminationGround,
  annualLeaveMin,
  leaveCashSwap,
  noticePeriod,
  maternityMin,
  srcRegistration,
];

export function parseRules(raw: unknown[]): RuleDefinition[] {
  const rules = raw.map((r) => ruleSchema.parse(r));
  const ids = new Set<string>();
  for (const r of rules) {
    if (ids.has(r.id)) throw new Error(`Duplicate rule id: ${r.id}`);
    ids.add(r.id);
  }
  return rules;
}

export const RULES: RuleDefinition[] = parseRules(RAW);
