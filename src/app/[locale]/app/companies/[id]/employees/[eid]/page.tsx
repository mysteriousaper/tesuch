import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AddLeaveForm } from "@/components/dashboard/dashboard-forms";
import { fmtDate } from "@/components/dashboard/finding-list";
import { todayIso } from "@/components/dashboard/queries";
import { Timeline, type TimelineEvent } from "@/components/dashboard/timeline";
import { Link, redirect } from "@/i18n/navigation";
import { RULES } from "@/lib/rules/catalog";
import { supabaseForUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

interface ContractRow {
  type: "indefinite" | "fixed_term"; start_date: string; end_date: string | null; probation_end: string | null;
  terminated_on: string | null; termination_ground: string | null; notice_given_on: string | null;
}

export default async function EmployeePage({ params }: { params: Promise<{ locale: string; id: string; eid: string }> }) {
  const { locale, id, eid } = await params;
  setRequestLocale(locale);
  if (!UUID.test(id) || !UUID.test(eid)) notFound();
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });

  const { data: emp } = await supabase
    .from("employees")
    .select("id, full_name, birth_date, six_day_week, org_id, companies(name), contracts(type, start_date, end_date, probation_end, terminated_on, termination_ground, notice_given_on), leave_records(type, start_date, days)")
    .eq("id", eid).eq("company_id", id).maybeSingle();
  if (!emp) notFound();

  const [{ data: findings }, { data: membership }] = await Promise.all([
    supabase.from("findings").select("rule_id, due_date, severity").eq("employee_id", eid).eq("status", "open"),
    supabase.from("memberships").select("role").eq("user_id", user.id).eq("org_id", emp.org_id).maybeSingle(),
  ]);
  const canEdit = membership?.role === "owner" || membership?.role === "accountant";

  const t = await getTranslations("dashboard");
  const today = todayIso();
  const loc = locale as "hy" | "ru" | "en";
  const events: TimelineEvent[] = [];

  for (const k of (emp.contracts ?? []) as ContractRow[]) {
    events.push({ date: k.start_date, label: t("events.contractStart"), tone: "accent", detail: t(k.type === "fixed_term" ? "fields.fixedTerm" : "fields.indefinite") });
    if (k.probation_end) events.push({ date: k.probation_end, label: t("events.probationEnd"), tone: "warn" });
    if (k.end_date) events.push({ date: k.end_date, label: t("events.contractEnd"), tone: "warn" });
    if (k.notice_given_on) events.push({ date: k.notice_given_on, label: t("events.notice"), tone: "neutral" });
    if (k.terminated_on) events.push({ date: k.terminated_on, label: t("events.terminated"), tone: "neutral", detail: k.termination_ground ?? undefined });
  }
  for (const l of (emp.leave_records ?? []) as { type: "annual" | "maternity" | "cash_compensation" | "other"; start_date: string; days: number }[]) {
    events.push({ date: l.start_date, label: t("events.leave", { type: t(`leaveTypes.${l.type}`), days: l.days }), tone: "ok" });
  }
  for (const f of findings ?? []) {
    const rule = RULES.find((r) => r.id === f.rule_id);
    events.push({ date: f.due_date, label: t("events.findingDue", { title: rule?.title[loc] ?? f.rule_id }), tone: f.due_date < today ? "danger" : "warn" });
  }

  const company = emp.companies as unknown as { name: string } | null;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href={`/app/companies/${id}`} className="text-sm text-muted hover:text-ink">← {company?.name ?? t("back")}</Link>
      <header className="rounded-theme-lg border border-line bg-surface p-4">
        <h1 className="text-2xl font-bold">{emp.full_name}</h1>
        <p className="flex flex-wrap gap-x-3 text-sm text-muted">
          {emp.birth_date && (
            <span>{t("fields.birthDate")} · <time dateTime={emp.birth_date}>{fmtDate(emp.birth_date)}</time></span>
          )}
          {emp.six_day_week && <span>{t("fields.sixDayWeek")}</span>}
        </p>
      </header>

      <section className="rounded-theme-lg border border-line bg-surface p-4" aria-labelledby="timeline-h">
        <h2 id="timeline-h" className="mb-2 font-semibold">{t("timeline")}</h2>
        <Timeline events={events} today={today} />
      </section>

      {canEdit && (
        <section className="rounded-theme-lg border border-line bg-surface p-4" aria-labelledby="leave-h">
          <h2 id="leave-h" className="mb-3 font-semibold">{t("addLeave")}</h2>
          <AddLeaveForm locale={locale} companyId={id} employeeId={eid} />
        </section>
      )}
    </div>
  );
}
