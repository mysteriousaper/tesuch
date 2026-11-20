import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScoreGauge } from "@/components/score-gauge";
import { CompanyList } from "@/components/dashboard/company-list";
import { AddCompanyForm, LoadDemoButton } from "@/components/dashboard/dashboard-forms";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { currentOrg, firmOverview, userOrgs } from "@/components/dashboard/queries";
import { redirect } from "@/i18n/navigation";
import { supabaseForUser } from "@/lib/supabase/server";
import { createOrg } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });

  const org = await currentOrg(supabase, user.id);
  if (!org) {
    const t = await getTranslations("onboarding");
    return (
      <section className="flex max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <form action={createOrg.bind(null, locale)} className="flex flex-col gap-3">
          <label htmlFor="name" className="text-sm font-medium">{t("name")}</label>
          <input id="name" name="name" required maxLength={200} className="rounded-theme border border-control bg-surface px-3 py-2.5 text-base" />
          <button className="rounded-theme bg-accent px-4 py-2.5 font-semibold text-accent-ink">{t("create")}</button>
        </form>
      </section>
    );
  }

  const t = await getTranslations("dashboard");
  const [{ rows, firm }, orgs] = await Promise.all([firmOverview(supabase, org.id), userOrgs(supabase, user.id)]);
  const canEdit = org.role !== "viewer";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-theme-lg border border-line bg-surface p-4">
          <div className="flex flex-col gap-2">
            <OrgSwitcher locale={locale} orgs={orgs} current={org.id} />
            <h1 className="text-2xl font-bold">{org.name}</h1>
            <p className="text-sm text-muted">{t("employeesCount", { count: rows.reduce((s, r) => s + r.staff, 0) })} · {t("openFindings", { count: rows.reduce((s, r) => s + r.open, 0) })}</p>
          </div>
          {firm !== null && (
            <div className="flex max-w-[220px] flex-col items-center gap-1">
              <ScoreGauge value={firm} label={t("firmScore")} size={160} />
              <p className="text-center text-xs text-muted">{t("scoreDisclaimer")}</p>
            </div>
          )}
        </div>

        <div className="rounded-theme-lg border border-line bg-surface">
          <h2 className="flex items-baseline justify-between border-b border-line px-4 py-3 font-semibold">
            {t("companies")} <span className="text-xs font-normal text-muted">{t("sortedByScore")}</span>
          </h2>
          {rows.length ? <CompanyList rows={rows} /> : <p className="px-4 py-8 text-center text-muted">{t("noCompanies")}</p>}
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        {canEdit ? (
          <>
            <section className="rounded-theme-lg border border-line bg-surface p-4">
              <h2 className="mb-3 font-semibold">{t("addCompany")}</h2>
              <AddCompanyForm locale={locale} />
            </section>
            <section className="rounded-theme-lg border border-line bg-surface p-4">
              <LoadDemoButton locale={locale} />
            </section>
          </>
        ) : (
          <p className="rounded-theme border border-line bg-surface p-4 text-sm text-muted">{t("viewerNote")}</p>
        )}
      </aside>
    </div>
  );
}
