import { getTranslations, setRequestLocale } from "next-intl/server";
import { SupportFooter, SupportHeaderLink } from "@/components/support-help";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { hasCurrentConsent } from "@/components/legal/consent";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { redirect } from "@/i18n/navigation";
import { supabaseForUser } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { GlassyShell } from "@/components/ui/glassy-dashboard";

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
    <GlassyShell
      brand={c("appName")}
      actions={
        <>
          <span className="gd-hide-sm"><SupportHeaderLink /></span>
          <ModeToggle />
          <LocaleSwitcher />
          <form action={async () => { "use server"; await signOut(); redirect({ href: "/login", locale }); }}>
            <button className="min-h-11 rounded-full px-3 text-sm font-semibold hover:underline">{a("signOut")}</button>
          </form>
        </>
      }
    >
      {children}
      <SupportFooter />
    </GlassyShell>
  );
}
