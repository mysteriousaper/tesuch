import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }> }) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const c = await getTranslations("common");
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-4 py-6">
      <header className="glass mb-6 flex items-center justify-between !rounded-full px-4 py-1.5">
        <Link href="/" className="text-lg font-bold">{c("appName")}</Link>
        <LocaleSwitcher />
      </header>
      <section className="glass my-auto flex flex-col gap-6 p-6 sm:p-8">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <LoginForm configured={configured} linkFailed={error === "1"} />
      </section>
    </main>
  );
}
