import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScoreGauge } from "@/components/score-gauge";
import { AddEmployeeForm, RecheckButton } from "@/components/dashboard/dashboard-forms";
import { FindingList, fmtDate, type FindingView } from "@/components/dashboard/finding-list";
import { statsFor } from "@/components/dashboard/stats";
import { companyStats, todayIso } from "@/components/dashboard/queries";
import { Link, redirect } from "@/i18n/navigation";
import { supabaseForUser } from "@/lib/supabase/server";
import { latestContract } from "../../dashboard-logic";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });

  // RLS hides companies of other firms: not visible = not found.
  const { data: company } = await supabase.from("companies").select("id, name, tax_id, org_id").eq("id", id).maybeSingle();
  if (!company) notFound();

  const [findingsRes, employeesRes] = await Promise.all([
    supabase.from("findings").select("id, rule_id, severity, due_date, status, employee_id, employees(full_name)").eq("company_id", id),
    supabase.from("employees").select("id, full_name, contracts(type, start_date, end_date, terminated_on)").eq("company_id", id).is("archived_at", null).order("full_name"),
  ]);
  const { data: membership } = await supabase.from("memberships").select("role").eq("user_id", user.id).eq("org_id", company.org_id).maybeSingle();
  const canEdit = membership?.role === "owner" || membership?.role === "accountant";

  const t = await getTranslations("dashboard");
  const c = await getTranslations("common");
  const today = todayIso();
  const findings: FindingView[] = (findingsRes.data ?? []).map((f) => ({
    id: f.id, rule_id: f.rule_id, severity: f.severity, due_date: f.due_date, status: f.status, employee_id: f.employee_id,
    employee_name: (f.employees as unknown as { full_name: string } | null)?.full_name ?? "",
  }));
  const open = findings.filter((f) => f.status === "open");
  const stats = statsFor(await companyStats(supabase, company.org_id, company.id), company.id);
  const score = stats.score;
  const employees = employeesRes.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/app" className="text-sm text-muted hover:text-ink">← {t("back")}</Link>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-theme-lg border border-line bg-surface p-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <p className="text-sm text-muted">
            {company.tax_id ? `${company.tax_id} · ` : ""}{t("employeesCount", { count: stats.staff })} · {t("openFindings", { count: stats.open })}
          </p>
          {canEdit && <div className="mt-2"><RecheckButton locale={locale} companyId={company.id} /></div>}
        </div>
        <ScoreGauge value={score} label={c("score")} size={160} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-theme-lg border border-line bg-surface" aria-labelledby="findings-h">
          <h2 id="findings-h" className="border-b border-line px-4 py-3 font-semibold">{t("findings")}</h2>
          <FindingList findings={findings} locale={locale} companyId={company.id} today={today} canEdit={canEdit} />
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="employees-h">
          <div className="rounded-theme-lg border border-line bg-surface">
            <h2 id="employees-h" className="border-b border-line px-4 py-3 font-semibold">{t("employees")}</h2>
            {employees.length ? (
              <ul className="divide-y divide-line">
                {employees.map((e) => {
                  const k = latestContract(e.contracts as unknown as { type: string; start_date: string; end_date: string | null; terminated_on: string | null }[]);
                  const n = open.filter((f) => f.employee_id === e.id).length;
                  return (
                    <li key={e.id}>
                      <Link href={`/app/companies/${company.id}/employees/${e.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">{e.full_name}</span>
                          {k && (
                            <span className="text-xs text-muted">
                              {t(k.type === "fixed_term" ? "fields.fixedTerm" : "fields.indefinite")} · {fmtDate(k.start_date)}
                              {k.end_date ? ` – ${fmtDate(k.end_date)}` : ""}
                            </span>
                          )}
                        </span>
                        {n > 0 && <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-danger">{n}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted">{t("noEmployees")}</p>
            )}
          </div>
          {canEdit && (
            <details className="rounded-theme-lg border border-line bg-surface">
              <summary className="cursor-pointer px-4 py-3 font-semibold">{t("addEmployee")}</summary>
              <div className="border-t border-line p-4"><AddEmployeeForm locale={locale} companyId={company.id} /></div>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}
