import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScoreGauge } from "@/components/score-gauge";
import { CompanyList } from "@/components/dashboard/company-list";
import { AddCompanyForm, LoadDemoButton } from "@/components/dashboard/dashboard-forms";
import { CodesNotice } from "@/components/dashboard/codes-notice";
import { codesNoticePending } from "@/components/dashboard/privacy";
import { inviteMember } from "./members/actions";
import { AssistedInviteCard } from "@/components/members/forms";
import { supportInviteEmail } from "@/components/members/lib";
import { OwnerHome } from "@/components/dashboard/owner-home";
import { ownerSnapshot } from "@/components/dashboard/owner-home-data";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { currentOrg, firmOverview, userOrgs } from "@/components/dashboard/queries";
import { Link, redirect } from "@/i18n/navigation";
import { supabaseForUser } from "@/lib/supabase/server";
import { createOrg } from "./actions";
import { canEditRole } from "./dashboard-logic";

export const dynamic = "force-dynamic";
// The demo-data action runs here and recomputes rules for three companies: allow the Hobby maximum.
export const maxDuration = 60;

export default async function AppHome({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ view?: string }> }) {
  const { locale } = await params;
  const { view } = await searchParams;
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
  const showCodesNotice = org.role === "owner" && (await codesNoticePending(supabase, org.id));

  // One business: the simple owner home. Two or more companies (or ?view=firm): the firm dashboard below.
  const single = rows.length === 1 && view !== "firm" ? rows[0] : null;
  if (single) {
    const [snapshot, { data: tg }, { data: tickRows }] = await Promise.all([
      ownerSnapshot(supabase, org.id, single.id),
      supabase.from("telegram_links").select("chat_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("checklist_ticks").select("question_no").eq("company_id", single.id), // error (table not migrated yet) reads as no ticks
    ]);
    const supportEmail = supportInviteEmail(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, org.role === "owner");
    return (
      <div className="flex flex-col gap-6">
        {showCodesNotice && <div className="mx-auto w-full max-w-2xl"><CodesNotice locale={locale} /></div>}
        <OwnerHome
          locale={locale} company={single} snapshot={snapshot} telegramLinked={Boolean(tg)}
          ticked={(tickRows ?? []).map((r) => r.question_no as string)} canEdit={canEditRole(org.role)}
          assisted={supportEmail ? <AssistedInviteCard action={inviteMember.bind(null, locale)} email={supportEmail} /> : null}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="flex flex-col gap-4">
        {showCodesNotice && <CodesNotice locale={locale} />}
        {rows.length === 1 && <Link href="/app" className="text-sm text-accent underline">{(await getTranslations("owner"))("backSimple")}</Link>}
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
            {rows.every((r) => r.staff === 0) && (
              <section className="rounded-theme-lg border border-line bg-surface p-4">
                <LoadDemoButton locale={locale} />
              </section>
            )}
          </>
        ) : (
          <p className="rounded-theme border border-line bg-surface p-4 text-sm text-muted">{t("viewerNote")}</p>
        )}
      </aside>
    </div>
  );
}
