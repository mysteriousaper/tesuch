import { addDays, addMonths, addYears, differenceInYears, format, parseISO } from "date-fns";
import type { ContractType, LeaveType, TerminationInitiator } from "@/lib/rules/types";

// Fictional demo data for one firm: 5 companies, 8 employees each. Names are random
// combinations of common Armenian first names and surnames, not real people.

const FIRST = ["Արամ", "Արմեն", "Դավիթ", "Գոռ", "Հայկ", "Կարեն", "Նարեկ", "Տիգրան", "Աննա", "Անի", "Լիլիթ", "Մարիամ", "Նարե", "Հասմիկ", "Սոնա", "Լուսինե"];
const LAST = ["Պետրոսյան", "Սարգսյան", "Հարությունյան", "Գրիգորյան", "Հակոբյան", "Վարդանյան", "Խաչատրյան", "Կարապետյան", "Գևորգյան", "Ավետիսյան", "Մկրտչյան", "Ղազարյան"];
const KINDS = ["Սրճարան", "Դեղատուն", "Տպարան", "Լոգիստիկա", "Հացատուն", "Հյուրանոց", "Կահույք", "Մարզասրահ"];

export interface DemoContract {
  type: ContractType;
  start_date: string;
  end_date: string | null;
  probation_end: string | null;
  probation_special_case: boolean;
  hired_by_transfer: boolean;
  fixed_term_ground: string | null;
  src_registered: boolean | null;
  terminated_on: string | null;
  termination_ground: string | null;
  termination_initiator: TerminationInitiator | null;
  notice_given_on: string | null;
  workforce_reduction: boolean;
}

export interface DemoEmployee {
  fullName: string;
  birthDate: string;
  sixDayWeek: boolean;
  contract: DemoContract;
  leave: { type: LeaveType; start_date: string; days: number }[];
}

export interface DemoCompany {
  name: string;
  employees: DemoEmployee[];
}

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * Scenario per employee slot, chosen so a demo firm shows a realistic mix of findings:
 * most people are compliant, a few trigger each rule.
 */
const SCENARIOS = ["clean", "minor", "probationMax", "probationEnding", "fixedEnding", "fixedNoGround", "srcMissing", "leaveShort", "clean", "noticeShort"] as const;

export function generateDemoCompanies(asOfIso: string, seed: number, companies = 5, perCompany = 8): DemoCompany[] {
  const rnd = prng(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const asOf = parseISO(asOfIso);
  const kinds = [...KINDS].sort(() => rnd() - 0.5).slice(0, companies);

  return kinds.map((kind, ci) => ({
    name: `Դեմո ${kind} ՍՊԸ`,
    employees: Array.from({ length: perCompany }, (_, k) => {
      const scenario = SCENARIOS[(ci * perCompany + k) % SCENARIOS.length];
      let birth = addYears(asOf, -between(22, 60));
      let start = addDays(asOf, -between(400, 3000));
      const c: DemoContract = {
        type: "indefinite", start_date: "", end_date: null, probation_end: null, probation_special_case: false,
        hired_by_transfer: false, fixed_term_ground: null, src_registered: true, terminated_on: null,
        termination_ground: null, termination_initiator: null, notice_given_on: null, workforce_reduction: false,
      };
      const sixDayWeek = rnd() < 0.2;
      let leaveDays = sixDayWeek ? 24 : 20;

      switch (scenario) {
        case "minor":
          birth = addDays(addYears(asOf, -17), -between(10, 200));
          start = addDays(asOf, -between(5, 30));
          c.probation_end = iso(addDays(addMonths(start, 2), -1));
          break;
        case "probationMax":
          start = addDays(asOf, -between(10, 50));
          c.probation_end = iso(addDays(addMonths(start, 4), -1));
          break;
        case "probationEnding":
          start = addDays(addMonths(asOf, -3), between(3, 12));
          c.probation_end = iso(addDays(addMonths(start, 3), -1));
          break;
        case "fixedEnding":
          c.type = "fixed_term";
          c.fixed_term_ground = "Սեզոնային աշխատանք";
          c.end_date = iso(addDays(asOf, between(5, 28)));
          break;
        case "fixedNoGround":
          c.type = "fixed_term";
          c.fixed_term_ground = ""; // explicitly none (null would mean unknown and skip the rule)
          c.end_date = iso(addDays(asOf, between(90, 300)));
          break;
        case "srcMissing":
          c.src_registered = false;
          break;
        case "leaveShort":
          leaveDays = between(5, 12);
          break;
        case "noticeShort": {
          const term = addDays(asOf, -between(5, 40));
          c.terminated_on = iso(term);
          c.termination_initiator = "employer";
          c.termination_ground = "Հաստիքների կրճատում";
          c.workforce_reduction = true;
          c.notice_given_on = iso(addDays(term, -between(10, 30)));
          break;
        }
      }
      c.start_date = iso(start);

      // Annual leave inside the last completed working year, so compliant people stay compliant.
      const years = differenceInYears(asOf, start);
      const leave = years >= 1
        ? [{ type: "annual" as const, start_date: iso(addDays(addYears(start, years - 1), between(30, 200))), days: leaveDays }]
        : [];

      return { fullName: `${pick(FIRST)} ${pick(LAST)}`, birthDate: iso(birth), sixDayWeek, contract: c, leave };
    }),
  }));
}
