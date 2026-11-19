import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ConsentGate } from "@/components/legal/consent-gate";
import { missingConsentsFor } from "@/components/legal/consent";
import { DraftBanner } from "@/components/legal/draft-banner";
import { Link, redirect } from "@/i18n/navigation";
import { supabaseForUser } from "@/lib/supabase/server";
import { signOut } from "../app/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.consent" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Consent gate: the /app layout redirects here while the signed-in user has not accepted the current
 * Terms and Privacy versions (src/components/legal/versions.ts). Lives outside /app so it is not itself gated.
 */
export default async function ConsentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return redirect({ href: "/login", locale });
  const supabase = await supabaseForUser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });
  if (!(await missingConsentsFor(supabase, user.id)).length) return redirect({ href: "/app", locale });

  const t = await getTranslations("legal.consent");
  const c = await getTranslations("common");
  const a = await getTranslations("auth");
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="text-lg font-bold">{c("appName")}</Link>
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 flex-col justify-center gap-5 py-8">
        <h1 className="text-3xl font-bold leading-tight">{t("title")}</h1>
        <p className="leading-relaxed text-muted">{t("intro")}</p>
        <DraftBanner />
        <ConsentGate />
        <form
          action={async () => {
            "use server";
            await signOut();
            redirect({ href: "/login", locale });
          }}
        >
          <button className="text-sm text-muted underline underline-offset-2 hover:text-ink">{t("decline")} · {a("signOut")}</button>
        </form>
      </main>
    </div>
  );
}
