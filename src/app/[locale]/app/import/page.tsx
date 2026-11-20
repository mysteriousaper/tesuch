import { getTranslations, setRequestLocale } from "next-intl/server";
import { ImportWizard, type ImportCompany } from "@/components/import/import-wizard";
import { privacyOrgIds } from "@/components/dashboard/privacy";
import type { Locale } from "@/lib/notify/i18n";
import { supabaseForUser } from "@/lib/supabase/server";

export default async function ImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("import");

  // Only companies in orgs where the user can edit (owner/accountant). RLS limits both queries to the user's orgs.
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: memberships }, { data: companies }, privacyOrgs] = await Promise.all([
    supabase.from("memberships").select("org_id, role").eq("user_id", user?.id ?? ""),
    supabase.from("companies").select("id, name, org_id").order("name"),
    privacyOrgIds(supabase),
  ]);
  const editable = new Set((memberships ?? []).filter((m) => m.role === "owner" || m.role === "accountant").map((m) => m.org_id));
  const options: ImportCompany[] = (companies ?? []).filter((c) => editable.has(c.org_id)).map((c) => ({ id: c.id, name: c.name, privacy: privacyOrgs.has(c.org_id) }));

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("intro")}</p>
      </header>
      <ImportWizard locale={locale as Locale} companies={options} />
    </div>
  );
}
