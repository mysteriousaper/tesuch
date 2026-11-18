import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { redirect } from "@/i18n/navigation";
import { supabaseForUser } from "@/lib/supabase/server";
import { createOrg, signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return redirect({ href: "/login", locale });

  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });

  const { data: orgs } = await supabase.from("orgs").select("id, name").order("created_at");
  const t = await getTranslations("onboarding");
  const a = await getTranslations("auth");
  const c = await getTranslations("common");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-8 flex items-center justify-between gap-3">
        <span className="text-lg font-bold">{c("appName")}</span>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <form action={async () => { "use server"; await signOut(); redirect({ href: "/login", locale }); }}>
            <button className="text-sm text-muted hover:text-ink">{a("signOut")}</button>
          </form>
        </div>
      </header>
      {orgs && orgs.length > 0 ? (
        <section>
          <h1 className="mb-4 text-2xl font-bold">{t("yourOrgs")}</h1>
          <ul className="divide-y divide-line rounded-theme-lg border border-line bg-surface">
            {orgs.map((o) => <li key={o.id} className="px-4 py-3 font-medium">{o.name}</li>)}
          </ul>
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
    </main>
  );
}
