import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AcceptForm, InviteSignIn } from "@/components/members/invite-client";
import { TOKEN_RE, type Role } from "@/components/members/lib";
import { Link } from "@/i18n/navigation";
import { supabaseForUser } from "@/lib/supabase/server";
import { signOut } from "../../app/actions";
import { acceptInvite } from "./actions";

export const dynamic = "force-dynamic";
// Invite links carry a secret: keep them out of search engines and referrers.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

interface Preview { org_name: string; role: Role; email: string; status: "ok" | "used" | "expired" | "mismatch" }

export default async function InvitePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("members.accept");
  const r = await getTranslations("members.roles");
  const c = await getTranslations("common");
  const a = await getTranslations("auth");

  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabase = configured ? await supabaseForUser() : null;
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  let preview: Preview | null = null;
  if (supabase && user && TOKEN_RE.test(token)) {
    const { data } = await supabase.rpc("invitation_preview", { p_token: token });
    preview = ((data as Preview[] | null) ?? [])[0] ?? null;
  }

  let body: React.ReactNode;
  if (!TOKEN_RE.test(token) || (user && !preview)) {
    body = <p role="alert" className="text-danger">{t("errors.notFound")}</p>;
  } else if (!user) {
    body = (
      <>
        <p className="text-muted">{t("signInFirst")}</p>
        {configured ? <InviteSignIn /> : <p className="text-sm text-muted">{a("notConfigured")}</p>}
      </>
    );
  } else if (preview!.status === "mismatch") {
    body = (
      <>
        <p role="alert" className="text-danger">{t("mismatch", { invited: preview!.email, current: user.email ?? "" })}</p>
        <form action={async () => { "use server"; await signOut(); }}>
          <button className="rounded-theme border border-control bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface-2">{t("switchAccount")}</button>
        </form>
      </>
    );
  } else if (preview!.status !== "ok") {
    body = <p role="alert" className="text-danger">{t(`errors.${preview!.status === "used" ? "used" : "expired"}`)}</p>;
  } else {
    body = (
      <>
        <p>{t("summary", { org: preview!.org_name, role: r(preview!.role) })}</p>
        <p className="text-sm text-muted">{t("as", { email: user.email ?? "" })}</p>
        <AcceptForm action={acceptInvite.bind(null, locale, token)} />
      </>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">{c("appName")}</Link>
        <LocaleSwitcher />
      </header>
      <section className="flex flex-1 flex-col justify-center gap-4">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        {body}
        {user && <Link href="/app" className="text-sm text-muted underline">{t("toApp")}</Link>}
      </section>
    </main>
  );
}
