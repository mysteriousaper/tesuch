import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toRuleRow } from "../../src/lib/jobs/mappers";
import { RULES } from "../../src/lib/rules/catalog";
import { hasSupabase } from "./helpers/env";
import { admin, anon, clientAs, createTestUser, deleteTestUsers, type TestUser, keepNames } from "./helpers/supabase";

/**
 * Cross-tenant attacks through the real Supabase REST API (PostgREST + RLS), as signed-in users.
 * Complements supabase/tests/rls_cross_tenant.sql, which runs the same policies on plain Postgres.
 */
test.describe("cross-tenant isolation (live Supabase)", () => {
  test.skip(!hasSupabase(), "Supabase keys not configured");
  test.describe.configure({ mode: "serial" });

  let a: TestUser, b: TestUser;
  let asA: SupabaseClient, asB: SupabaseClient;
  let orgA: string, companyA: string, employeeA: string, findingA: string;

  test.beforeAll(async () => {
    [a, b] = await Promise.all([createTestUser("tenant-a"), createTestUser("tenant-b")]);
    [asA, asB] = await Promise.all([clientAs(a), clientAs(b)]);

    const { data: org, error } = await asA.rpc("create_org", { p_name: "QA Tenant A" });
    expect(error).toBeNull();
    orgA = org as string;
    await keepNames(orgA);
    const co = await asA.from("companies").insert({ org_id: orgA, name: "A Co" }).select("id").single();
    expect(co.error).toBeNull();
    companyA = co.data!.id;
    const emp = await asA.from("employees").insert({ org_id: orgA, company_id: companyA, full_name: "QA Employee A" }).select("id").single();
    expect(emp.error).toBeNull();
    employeeA = emp.data!.id;

    // Findings are system-written: seed one with the service role, as the nightly job would.
    const db = admin();
    // Same rows the nightly job writes, so tests never leave a placeholder definition behind.
    await db.from("rules").upsert(RULES.map(toRuleRow), { onConflict: "id,version", ignoreDuplicates: true });
    const f = await db
      .from("findings")
      .insert({ org_id: orgA, company_id: companyA, employee_id: employeeA, rule_id: "probation-max", rule_version: 1, severity: "advisory", due_date: "2026-12-01" })
      .select("id")
      .single();
    expect(f.error).toBeNull();
    findingA = f.data!.id;

    await asB.rpc("create_org", { p_name: "QA Tenant B" });
  });

  test.afterAll(async () => deleteTestUsers([a?.id, b?.id].filter(Boolean)));

  test("A sees its own data", async () => {
    expect((await asA.from("companies").select("id")).data).toEqual([{ id: companyA }]);
    expect((await asA.from("findings").select("id")).data).toEqual([{ id: findingA }]);
  });

  for (const table of ["orgs", "companies", "employees", "contracts", "leave_records", "findings", "alerts_log", "audit_log", "telegram_links"]) {
    test(`B cannot read A's ${table}`, async () => {
      const { data, error } = await asB.from(table).select("*");
      expect(error).toBeNull();
      const leaked = (data ?? []).filter((r: Record<string, unknown>) => r.org_id === orgA || r.id === orgA || r.user_id === a.id);
      expect(leaked).toEqual([]);
    });
  }

  test("B cannot update or delete A's company (silently affects 0 rows)", async () => {
    const upd = await asB.from("companies").update({ name: "pwned" }).eq("id", companyA).select("id");
    expect(upd.data ?? []).toEqual([]);
    const del = await asB.from("employees").delete().eq("id", employeeA).select("id");
    expect(del.data ?? []).toEqual([]);
    const fix = await asB.from("findings").update({ status: "fixed" }).eq("id", findingA).select("id");
    expect(fix.data ?? []).toEqual([]);

    const { data } = await admin().from("companies").select("name").eq("id", companyA).single();
    expect(data?.name).toBe("A Co");
    const emp = await admin().from("employees").select("id").eq("id", employeeA);
    expect(emp.data).toHaveLength(1);
    const fnd = await admin().from("findings").select("status").eq("id", findingA).single();
    expect(fnd.data?.status).toBe("open");
  });

  test("B cannot insert into A's org or join it", async () => {
    const co = await asB.from("companies").insert({ org_id: orgA, name: "evil" });
    expect(co.error?.message).toMatch(/row-level security/);
    const m = await asB.from("memberships").insert({ user_id: b.id, org_id: orgA, role: "owner" });
    expect(m.error?.message).toMatch(/permission denied/);
  });

  test("B cannot attach rows to A's company even with its own org id", async () => {
    const { data: bOrg } = await asB.from("orgs").select("id").single();
    const e = await asB.from("employees").insert({ org_id: bOrg!.id, company_id: companyA, full_name: "x" });
    expect(e.error).not.toBeNull();
  });

  test("A cannot rewrite a finding's severity, only its status", async () => {
    const bad = await asA.from("findings").update({ severity: "info" }).eq("id", findingA);
    expect(bad.error?.message).toMatch(/only status( and assignee)? can be changed/);
    const ok = await asA.from("findings").update({ status: "fixed" }).eq("id", findingA).select("status, resolved_by").single();
    expect(ok.data).toEqual({ status: "fixed", resolved_by: a.id });
  });

  test("users cannot write rules, audit log or alerts", async () => {
    expect((await asA.from("rules").insert({ id: "x", version: 1, status: "verified", definition: {}, source_url: "https://www.arlis.am/" })).error).not.toBeNull();
    expect((await asA.from("audit_log").insert({ action: "x", table_name: "y" })).error).not.toBeNull();
    expect((await asA.from("alerts_log").insert({ org_id: orgA, channel: "email", kind: "alert", ok: true })).error).not.toBeNull();
  });

  test("users cannot link a Telegram chat directly or read link tokens", async () => {
    const tok = await asA.rpc("create_telegram_link_token");
    expect(tok.error).toBeNull();
    expect(String(tok.data)).toMatch(/^[0-9a-f]{64}$/);
    expect((await asA.from("telegram_link_tokens").select("*")).data ?? []).toEqual([]);
    expect((await asA.from("telegram_links").insert({ user_id: a.id, chat_id: 42 })).error).not.toBeNull();
  });

  test("anonymous visitors cannot read any table or call RPCs", async () => {
    const c = anon();
    for (const table of ["orgs", "memberships", "companies", "employees", "contracts", "leave_records", "findings", "rules", "alerts_log", "templates", "audit_log", "telegram_links", "telegram_link_tokens"]) {
      const { data, error } = await c.from(table).select("*").limit(1);
      expect(error !== null || (data ?? []).length === 0, `anon read ${table}`).toBe(true);
    }
    expect((await c.rpc("create_org", { p_name: "x" })).error).not.toBeNull();
    expect((await c.rpc("create_telegram_link_token")).error).not.toBeNull();
  });
});
