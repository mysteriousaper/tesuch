import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { hasCurrentConsent } from "@/components/legal/consent";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { redirect } from "@/i18n/navigation";
import { supabaseForUser } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { AppNav } from "./app-nav";

export const dynamic = "force-dynamic";

/** Authenticated shell for every /app page: sign-in guard, header, navigation. */
export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return redirect({ href: "/login", locale });
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });
  // Legal gate: current terms + privacy must be accepted (page lives outside /app, so no loop).
  if (!(await hasCurrentConsent(supabase, user.id))) return redirect({ href: "/consent", locale });

  const c = await getTranslations("common");
  const a = await getTranslations("auth");
  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-lg font-bold">{c("appName")}</span>
        <div className="flex items-center gap-3">
          <ModeToggle />
          <LocaleSwitcher />
          <form action={async () => { "use server"; await signOut(); redirect({ href: "/login", locale }); }}>
            <button className="text-sm text-muted hover:text-ink">{a("signOut")}</button>
          </form>
        </div>
      </header>
      <AppNav />
      <main className="py-6">{children}</main>
    </div>
  );
}
