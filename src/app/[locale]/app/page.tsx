import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { supabaseForUser } from "@/lib/supabase/server";
import type { Locale } from "@/lib/notify/i18n";
import { createOrg } from "./actions";
import { NotificationsCard } from "./notifications-card";

export const dynamic = "force-dynamic";

export default async function AppHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });

  const { data: orgs } = await supabase.from("orgs").select("id, name").order("created_at");
  const { data: link } = await supabase.from("telegram_links").select("chat_id").eq("user_id", user.id).maybeSingle();
  const t = await getTranslations("onboarding");

  return (
    <div className="max-w-3xl">
      {orgs && orgs.length > 0 ? (
        <section className="flex flex-col gap-6">
          <h1 className="text-2xl font-bold">{t("yourOrgs")}</h1>
          <ul className="divide-y divide-line rounded-theme-lg border border-line bg-surface">
            {orgs.map((o) => <li key={o.id} className="px-4 py-3 font-medium">{o.name}</li>)}
          </ul>
          <NotificationsCard locale={locale as Locale} linked={Boolean(link)} email={user.email ?? null} />
        </section>
      ) : (
        <section className="flex max-w-sm flex-col gap-4">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <form action={createOrg.bind(null, locale)} className="flex flex-col gap-3">
            <label htmlFor="name" className="text-sm font-medium">{t("name")}</label>
            <input id="name" name="name" required maxLength={200} className="rounded-theme border border-line bg-surface px-3 py-2.5 text-base" />
            <button className="rounded-theme bg-accent px-4 py-2.5 font-semibold text-accent-ink">{t("create")}</button>
          </form>
        </section>
      )}
    </div>
  );
}
