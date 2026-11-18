// Deterministic demo data: 3 firms, 15 companies, 200 employees, all fictional.
// Names are random combinations of common Armenian first names and surnames, not real people.
//
//   pnpm tsx scripts/seed-demo.ts            → writes supabase/seed/demo.sql and prints a findings summary
//
// Apply after the migration (local/staging only, never production).
import { addDays, addMonths, addYears, format, parseISO } from "date-fns";
import { writeFileSync } from "node:fs";
import { RULES } from "../src/lib/rules/catalog";
import { evaluateCompany } from "../src/lib/rules/engine";
import { inspectionReadyScore, firmScore } from "../src/lib/rules/score";
import type { Contract, Employee, LeaveRecord, TerminationInitiator } from "../src/lib/rules/types";

export const AS_OF = "2026-11-18";
const SEED = 20261118;
const TOTAL_EMPLOYEES = 200;

// ---------- deterministic PRNG (mulberry32) ----------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MALE = ["Արամ", "Արմեն", "Արման", "Դավիթ", "Գոռ", "Հայկ", "Կարեն", "Նարեկ", "Տիգրան", "Վահե", "Սամվել", "Էդգար", "Միքայել", "Ռուբեն"];
const FEMALE = ["Աննա", "Անի", "Լիլիթ", "Մարիամ", "Նարե", "Հասմիկ", "Գայանե", "Սոնա", "Աստղիկ", "Լուսինե", "Մանե", "Էլեն", "Տաթև", "Արփի"];
const SURNAMES = ["Պետրոսյան", "Սարգսյան", "Հարությունյան", "Գրիգորյան", "Հակոբյան", "Վարդանյան", "Խաչատրյան", "Կարապետյան", "Գևորգյան", "Ավետիսյան", "Մկրտչյան", "Հովհաննիսյան", "Մարտիրոսյան", "Ղազարյան", "Մանուկյան", "Դավթյան"];

const FIRMS = ["Դեմո Հաշվապահ Ա", "Դեմո Հաշվապահ Բ", "Դեմո Հաշվապահ Գ"];
const COMPANY_KINDS = ["Սրճարան", "Շինարար", "Դեղատուն", "Հյուրանոց", "Տպարան", "Ավտոսպասարկում", "Հացատուն", "Ծրագրավորում", "Առևտուր", "Լոգիստիկա", "Ատամնաբուժարան", "Կահույք", "Տուրիզմ", "Գյուղմթերք", "Մարզասրահ"];
const FIXED_TERM_GROUNDS = ["Սեզոնային աշխատանք", "Ժամանակավոր բացակայող աշխատողի փոխարինում", "Որոշակի ծրագրի կատարում"];
const TERMINATION_GROUNDS = ["Աշխատողի նախաձեռնությամբ", "Կողմերի համաձայնությամբ", "Հաստիքների կրճատում", "Պայմանագրի ժամկետի ավարտ"];

export type Gender = "m" | "f";
export interface DemoEmployee extends Employee { fullName: string; gender: Gender }
export interface DemoCompany { id: string; orgId: string; name: string; taxId: string }
export interface DemoFirm { id: string; name: string; ownerId: string; email: string }
export interface DemoData {
  firms: DemoFirm[];
  companies: DemoCompany[];
  employees: (DemoEmployee & { orgId: string })[];
  contracts: (Contract & { orgId: string })[];
  leave: (LeaveRecord & { orgId: string })[];
}

/** Stable, valid v4-shaped UUIDs: kind in the first block, counter in the last. */
export function demoUuid(kind: number, n: number): string {
  return `${kind.toString(16).padStart(8, "0")}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function generateDemo(seed = SEED): DemoData {
  const rnd = mulberry32(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const chance = (p: number) => rnd() < p;
  const asOf = parseISO(AS_OF);
  const daysFromNow = (n: number) => iso(addDays(asOf, n));

  const firms: DemoFirm[] = FIRMS.map((name, i) => ({
    id: demoUuid(0x1, i + 1),
    name,
    ownerId: demoUuid(0xa, i + 1),
    email: `demo-owner-${i + 1}@example.com`,
  }));

  const companies: DemoCompany[] = COMPANY_KINDS.map((kind, i) => ({
    id: demoUuid(0x2, i + 1),
    orgId: firms[i % firms.length].id,
    name: `Դեմո ${kind} ՍՊԸ`,
    taxId: String(90000000 + i * 1111).slice(0, 8),
  }));

  // Company sizes: random weights, every company gets at least 3 people, total exactly 200.
  const weights = companies.map(() => 0.3 + rnd());
  const sum = weights.reduce((a, b) => a + b, 0);
  const sizes = weights.map((w) => Math.max(3, Math.floor((w / sum) * TOTAL_EMPLOYEES)));
  for (let i = 0; sizes.reduce((a, b) => a + b, 0) < TOTAL_EMPLOYEES; i = (i + 1) % sizes.length) sizes[i]++;

  const data: DemoData = { firms, companies, employees: [], contracts: [], leave: [] };
  let e = 0;
  let l = 0;

  companies.forEach((company, ci) => {
    for (let k = 0; k < sizes[ci]; k++) {
      e++;
      const gender: Gender = chance(0.5) ? "m" : "f";
      const id = demoUuid(0x3, e);
      const scenario = rnd();
      // Default: established, compliant employee.
      let age = between(21, 62);
      let start = addDays(asOf, -between(90, 365 * 12));
      let probationEnd: string | null = null;
      let type: Contract["type"] = "indefinite";
      let endDate: string | null = null;
      let fixedTermGround: string | null = null;
      let hiredByTransfer = false;
      let terminatedOn: string | null = null;
      let terminationGround: string | null = null;
      let initiator: TerminationInitiator | null = null;
      let noticeGivenOn: string | null = null;
      let workforceReduction = false;

      if (scenario < 0.05) {
        // Minor hired recently with probation → probation-minor
        age = between(16, 17);
        start = addDays(asOf, -between(5, 40));
        probationEnd = iso(addDays(addMonths(start, 2), -1));
      } else if (scenario < 0.09) {
        // Probation of 4 months → probation-max
        start = addDays(asOf, -between(10, 60));
        probationEnd = iso(addDays(addMonths(start, 4), -1));
      } else if (scenario < 0.16) {
        // Probation ending within two weeks → probation-ending
        probationEnd = daysFromNow(between(0, 14));
        start = addDays(addMonths(parseISO(probationEnd), -3), 1);
      } else if (scenario < 0.19) {
        // Hired by transfer with probation → probation-transfer
        hiredByTransfer = true;
        start = addDays(asOf, -between(5, 50));
        probationEnd = iso(addDays(addMonths(start, 3), -1));
      } else if (scenario < 0.34) {
        // Fixed-term; some end soon, some lack a ground
        type = "fixed_term";
        start = addDays(asOf, -between(60, 600));
        endDate = daysFromNow(chance(0.5) ? between(0, 30) : between(31, 300));
        fixedTermGround = chance(0.75) ? pick(FIXED_TERM_GROUNDS) : null;
      } else if (scenario < 0.43) {
        // Terminated in the last 3 months
        start = addDays(asOf, -between(200, 365 * 16));
        terminatedOn = daysFromNow(-between(1, 90));
        initiator = pick(["employer", "employee", "mutual"] as const);
        terminationGround = chance(0.7) ? pick(TERMINATION_GROUNDS) : null;
        if (initiator === "employer") {
          workforceReduction = chance(0.4);
          // Sometimes enough notice, sometimes not.
          noticeGivenOn = iso(addDays(parseISO(terminatedOn), -(chance(0.5) ? between(65, 90) : between(5, 30))));
        }
      }

      const birth = addDays(addYears(start, -age), -between(0, 364));
      const employee: DemoEmployee & { orgId: string } = {
        id,
        orgId: company.orgId,
        companyId: company.id,
        fullName: `${pick(gender === "m" ? MALE : FEMALE)} ${pick(SURNAMES)}`,
        gender,
        birthDate: chance(0.95) ? iso(birth) : null,
        sixDayWeek: chance(0.15),
      };
      data.employees.push(employee);
      data.contracts.push({
        id: demoUuid(0x4, e),
        orgId: company.orgId,
        employeeId: id,
        type,
        startDate: iso(start),
        endDate,
        probationEnd,
        probationSpecialCase: false,
        hiredByTransfer,
        fixedTermGround,
        srcRegistered: chance(0.85),
        terminatedOn,
        terminationGround,
        terminationInitiator: initiator,
        noticeGivenOn,
        workforceReduction,
      });

      // Annual leave in the last completed working year: most take the full minimum.
      const yearsOfService = Math.floor((asOf.getTime() - start.getTime()) / (365.25 * 86_400_000));
      if (yearsOfService >= 1) {
        const yearStart = addYears(start, yearsOfService - 1);
        const minimum = employee.sixDayWeek ? 24 : 20;
        const days = chance(0.8) ? minimum : between(5, minimum - 1);
        data.leave.push({ id: demoUuid(0x5, ++l), orgId: company.orgId, employeeId: id, type: "annual", startDate: iso(addDays(yearStart, between(30, 300))), days });
      }
      if (chance(0.02)) {
        data.leave.push({ id: demoUuid(0x5, ++l), orgId: company.orgId, employeeId: id, type: "cash_compensation", startDate: daysFromNow(-between(10, 200)), days: between(5, 20) });
      }
      if (gender === "f" && age >= 22 && age <= 42 && chance(0.06)) {
        data.leave.push({ id: demoUuid(0x5, ++l), orgId: company.orgId, employeeId: id, type: "maternity", startDate: daysFromNow(-between(30, 700)), days: chance(0.7) ? 140 : 120 });
      }
    }
  });
  return data;
}

// ---------- SQL ----------
const q = (v: string | number | boolean | null): string =>
  v === null ? "null" : typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : String(v);
const values = (rows: (string | number | boolean | null)[][]) => rows.map((r) => `  (${r.map(q).join(", ")})`).join(",\n");

export function toSql(d: DemoData): string {
  return `-- Generated by scripts/seed-demo.ts (seed ${SEED}, as of ${AS_OF}). Fictional demo data only.
-- Do not edit by hand; regenerate with: pnpm tsx scripts/seed-demo.ts
-- Demo users have no password; sign in through a magic link to the example.com addresses only in local setups.
begin;

insert into auth.users (id, email) values
${values(d.firms.map((f) => [f.ownerId, f.email]))};

insert into public.orgs (id, name, kind, locale) values
${values(d.firms.map((f) => [f.id, f.name, "accounting_firm", "hy"]))};

insert into public.memberships (user_id, org_id, role) values
${values(d.firms.map((f) => [f.ownerId, f.id, "owner"]))};

insert into public.companies (id, org_id, name, tax_id) values
${values(d.companies.map((c) => [c.id, c.orgId, c.name, c.taxId]))};

insert into public.employees (id, org_id, company_id, full_name, birth_date, six_day_week) values
${values(d.employees.map((e) => [e.id, e.orgId, e.companyId, e.fullName, e.birthDate, e.sixDayWeek]))};

insert into public.contracts (id, org_id, employee_id, type, start_date, end_date, probation_end, probation_special_case, hired_by_transfer, fixed_term_ground, src_registered, terminated_on, termination_ground, termination_initiator, notice_given_on, workforce_reduction) values
${values(d.contracts.map((c) => [c.id, c.orgId, c.employeeId, c.type, c.startDate, c.endDate, c.probationEnd, c.probationSpecialCase, c.hiredByTransfer, c.fixedTermGround, c.srcRegistered, c.terminatedOn, c.terminationGround, c.terminationInitiator, c.noticeGivenOn, c.workforceReduction]))};

insert into public.leave_records (id, org_id, employee_id, type, start_date, days) values
${values(d.leave.map((x) => [x.id, x.orgId, x.employeeId, x.type, x.startDate, x.days]))};

commit;
`;
}

async function main() {
  const data = generateDemo();
  writeFileSync("supabase/seed/demo.sql", toSql(data));

  const perRule = new Map<string, number>();
  const companyScores = new Map<string, number>();
  for (const c of data.companies) {
    const findings = await evaluateCompany(
      RULES,
      {
        employees: data.employees.filter((e) => e.companyId === c.id),
        contracts: data.contracts.filter((x) => data.employees.find((e) => e.id === x.employeeId)?.companyId === c.id),
        leave: data.leave.filter((x) => data.employees.find((e) => e.id === x.employeeId)?.companyId === c.id),
      },
      AS_OF,
    );
    for (const f of findings) perRule.set(f.ruleId, (perRule.get(f.ruleId) ?? 0) + 1);
    companyScores.set(c.id, inspectionReadyScore(findings));
  }

  console.log(`supabase/seed/demo.sql: ${data.firms.length} firms, ${data.companies.length} companies, ${data.employees.length} employees, ${data.contracts.length} contracts, ${data.leave.length} leave records`);
  console.log(`\nFindings per rule (as of ${AS_OF}):`);
  for (const r of RULES) console.log(`  ${r.id.padEnd(20)} ${perRule.get(r.id) ?? 0}`);
  console.log(`  ${"total".padEnd(20)} ${[...perRule.values()].reduce((a, b) => a + b, 0)}`);
  console.log("\nScores:");
  for (const f of data.firms) {
    const cos = data.companies.filter((c) => c.orgId === f.id);
    console.log(`  ${f.name}: firm ${firmScore(cos.map((c) => companyScores.get(c.id)!))} | ${cos.map((c) => `${c.name} ${companyScores.get(c.id)}`).join(", ")}`);
  }
}

if (process.argv[1]?.endsWith("seed-demo.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
