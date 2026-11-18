import { getTranslations, setRequestLocale } from "next-intl/server";
import { RenameOrgForm } from "@/components/dashboard/dashboard-forms";
import { currentOrg, type Role } from "@/components/dashboard/queries";
import { redirect } from "@/i18n/navigation";
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
  const org = await currentOrg(supabase, user.id);
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
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

      {org && (
        <section className="flex flex-col gap-4 rounded-theme-lg border border-line bg-surface p-4" aria-labelledby="org-h">
          <h2 id="org-h" className="text-lg font-semibold">{t("settings.org")}</h2>
          {org.role === "owner" ? (
            <RenameOrgForm locale={locale} orgId={org.id} name={org.name} />
          ) : (
            <p className="font-medium">{org.name}</p>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("settings.members")}</h3>
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

      <NotificationsCard locale={locale as Locale} linked={Boolean(link)} email={user.email ?? null} />
    </div>
  );
}
