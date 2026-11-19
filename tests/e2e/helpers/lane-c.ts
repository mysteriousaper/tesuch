import { expect } from "@playwright/test";
import { toRuleRow } from "../../../src/lib/jobs/mappers";
import { RULES } from "../../../src/lib/rules/catalog";
import { admin, clientAs, type TestUser } from "./supabase";

export interface DocsFixture {
  orgId: string;
  companyId: string;
  /** Fixed-term contract with probation: every document type applies. */
  contractId: string;
  /** Indefinite contract, terminated by workforce reduction. */
  dismissalContractId: string;
}

/** Firm → company → 2 employees with contracts → 1 open finding, created as `user` (RLS applies). */
export async function seedDocsFixture(user: TestUser, label: string): Promise<DocsFixture> {
  const db = await clientAs(user);
  const org = await db.rpc("create_org", { p_name: `QA ${label}` });
  expect(org.error).toBeNull();
  const orgId = org.data as string;
  const co = await db.from("companies").insert({ org_id: orgId, name: "Դեմո Լոգիստիկ ՍՊԸ" }).select("id").single();
  expect(co.error).toBeNull();
  const companyId = co.data!.id as string;
  const emps = await db
    .from("employees")
    .insert([
      { org_id: orgId, company_id: companyId, full_name: "Արամ Դեմոյան", birth_date: "1990-01-01" },
      { org_id: orgId, company_id: companyId, full_name: "Анна Демова", birth_date: "1985-05-05" },
    ])
    .select("id, full_name");
  expect(emps.error).toBeNull();
  const [aram, anna] = ["Արամ Դեմոյան", "Анна Демова"].map((n) => emps.data!.find((e) => e.full_name === n)!.id as string);
  const c1 = await db
    .from("contracts")
    .insert({ org_id: orgId, employee_id: aram, type: "fixed_term", start_date: "2026-09-01", end_date: "2026-12-10", probation_end: "2026-11-30", fixed_term_ground: "սեզոնային աշխատանք" })
    .select("id")
    .single();
  expect(c1.error).toBeNull();
  const c2 = await db
    .from("contracts")
    .insert({ org_id: orgId, employee_id: anna, type: "indefinite", start_date: "2012-03-01", workforce_reduction: true, terminated_on: "2026-12-01", termination_ground: "հաստիքների կրճատում", termination_initiator: "employer", notice_given_on: "2026-11-15" })
    .select("id")
    .single();
  expect(c2.error).toBeNull();

  // Findings are system-written (service role), exactly as the nightly job does.
  const sys = admin();
  await sys.from("rules").upsert(RULES.map(toRuleRow), { onConflict: "id,version", ignoreDuplicates: true });
  const f = await sys.from("findings").insert({
    org_id: orgId, company_id: companyId, employee_id: aram, contract_id: c1.data!.id, rule_id: "fixed-term-ending", rule_version: 1, severity: "advisory", due_date: "2026-12-10",
  });
  expect(f.error).toBeNull();
  return { orgId, companyId, contractId: c1.data!.id as string, dismissalContractId: c2.data!.id as string };
}

/** Every PDF URL for a fixture, as the documents page links them. */
export const pdfUrls = (f: DocsFixture) => ({
  checklist: `/api/pdf/checklist?company=${f.companyId}&locale=hy`,
  probation: `/api/pdf/probation?contract=${f.contractId}&decision=confirm`,
  fixedTermEnd: `/api/pdf/fixed-term-end?contract=${f.contractId}`,
  dismissal: `/api/pdf/dismissal?contract=${f.dismissalContractId}&date=2026-11-15`,
});
