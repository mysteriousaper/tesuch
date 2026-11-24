import { getTranslations, setRequestLocale } from "next-intl/server";
import { RenameOrgForm } from "@/components/dashboard/dashboard-forms";
import { PrivacyModeForm } from "@/components/dashboard/privacy-mode-form";
import { orgPrivacyMode } from "@/components/dashboard/privacy";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { currentOrg, userOrgs, type Role } from "@/components/dashboard/queries";
import { createOrg } from "../actions";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/lib/notify/i18n";
import { supabaseForUser, supabaseService } from "@/lib/supabase/server";
import { NotificationsCard } from "../notifications-card";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });

  const t = await getTranslations("dashboard");
  const [org, orgs] = await Promise.all([currentOrg(supabase, user.id), userOrgs(supabase, user.id)]);
  const o = await getTranslations("onboarding");
  const m = await getTranslations("members");
  const privacy = org?.role === "owner" ? await orgPrivacyMode(supabase, org.id) : false;
  const { data: link } = await supabase.from("telegram_links").select("chat_id").eq("user_id", user.id).maybeSingle();

  // Members are read through RLS (only orgs the user belongs to); emails come from the auth admin API for those ids only.
  let members: { user_id: string; role: Role; email: string | null }[] = [];
  if (org) {
    const { data } = await supabase.from("memberships").select("user_id, role").eq("org_id", org.id).order("created_at");
    const admin = supabaseService();
    members = await Promise.all(
      (data ?? []).map(async (m) => ({
        user_id: m.user_id as string,
        role: m.role as Role,
        email: (await admin.auth.admin.getUserById(m.user_id)).data.user?.email ?? null,
      })),
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="glass px-5 py-4 text-2xl font-bold" data-glass-enter>{t("settings.title")}</h1>

      {org && (
        <section className="flex flex-col gap-4 glass p-4" aria-labelledby="org-h">
          <h2 id="org-h" className="text-lg font-semibold">{t("settings.org")}</h2>
          <OrgSwitcher locale={locale} orgs={orgs} current={org.id} />
          {org.role === "owner" ? (
            <RenameOrgForm locale={locale} orgId={org.id} name={org.name} />
          ) : (
            <p className="font-medium">{org.name}</p>
          )}
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{t("settings.members")}</h3>
              {/* Engineering: team management lives on its own page until it is in the main nav. */}
              <Link href="/app/members" className="text-sm text-accent underline">{m("title")}</Link>
            </div>
            <ul className="divide-y divide-line rounded-theme border border-line">
              {members.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {m.email ?? "—"}
                    {m.user_id === user.id && <span className="text-muted"> ({t("settings.you")})</span>}
                  </span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium">{t(`settings.roles.${m.role}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {org?.role === "owner" && (
        <section className="flex flex-col gap-3 glass p-4" aria-labelledby="privacy-h">
          <h2 id="privacy-h" className="text-lg font-semibold">{t("settings.privacy.title")}</h2>
          <p className="text-sm text-muted">{t("settings.privacy.intro")}</p>
          <p className="text-sm text-muted">{t("settings.privacy.table")}</p>
          <p className="text-sm text-muted">{t("settings.privacy.existing")}</p>
          <PrivacyModeForm locale={locale} enabled={privacy} />
        </section>
      )}

      <NotificationsCard locale={locale as Locale} linked={Boolean(link)} email={user.email ?? null} />

      <details className="glass">
        <summary className="cursor-pointer px-4 py-3 font-semibold">{t("org.createAnother")}</summary>
        <form action={createOrg.bind(null, locale)} className="flex flex-col gap-3 border-t border-line p-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {o("name")}
            <input name="name" required maxLength={200} className="rounded-full border border-control bg-surface px-3 py-2.5 text-base" />
          </label>
          <button className="self-start rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink">{o("create")}</button>
        </form>
      </details>
    </div>
  );
}
