import { PageHead } from "@/components/ui/glassy-dashboard";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AssistedInviteCard, ConfirmForm, CopyLink, InviteForm, RoleForm } from "@/components/members/forms";
import { inviteUrl, supportInviteEmail, type Role } from "@/components/members/lib";
import { baseUrl, emailsFor, orgSession } from "@/components/members/server";
import { Link, redirect } from "@/i18n/navigation";
import { changeRole, inviteMember, removeMember, revokeInvite } from "./actions";

export const dynamic = "force-dynamic";

interface Invite { id: string; email: string; role: Role; token: string; expires_at: string }

export default async function MembersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user, org } = await orgSession();
  if (!user) return redirect({ href: "/login", locale });
  const t = await getTranslations("members");
  const fmt = await getFormatter();

  if (!org) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("noOrg")}</p>
      </div>
    );
  }

  const isOwner = org.role === "owner";
  const [{ data: rows }, invites] = await Promise.all([
    supabase.from("memberships").select("user_id, role, created_at").eq("org_id", org.id).order("created_at"),
    isOwner
      ? supabase.from("invitations").select("id, email, role, token, expires_at").eq("org_id", org.id).is("accepted_at", null).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Invite[], error: null }),
  ]);
  const emails = await emailsFor((rows ?? []).map((m) => m.user_id as string));
  const members = (rows ?? []).map((m) => ({ user_id: m.user_id as string, role: m.role as Role, email: emails.get(m.user_id as string) ?? "—" }));
  const owners = members.filter((m) => m.role === "owner").length;
  const now = new Date();
  const base = await baseUrl();
  const supportEmail = supportInviteEmail(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, isOwner);

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        title={t("title")}
        description={org.name}
        actions={
          <nav aria-label={t("related")} className="flex flex-wrap gap-2">
            <Link href="/app/members/data" className="gd-secondary">{t("data.link")}</Link>
            {isOwner && <Link href="/app/audit" className="gd-secondary">{t("auditLink")}</Link>}
          </nav>
        }
      />

      {isOwner && (
        <section className="flex flex-col gap-3 glass p-4" aria-labelledby="invite-h">
          <h2 id="invite-h" className="text-lg font-semibold">{t("invite.title")}</h2>
          <p className="text-sm text-muted">{t("invite.hint")}</p>
          <InviteForm action={inviteMember.bind(null, locale)} />
        </section>
      )}

      {supportEmail && <AssistedInviteCard action={inviteMember.bind(null, locale)} email={supportEmail} />}

      <section className="flex flex-col gap-3 glass p-4" aria-labelledby="members-h">
        <h2 id="members-h" className="text-lg font-semibold">{t("members.title", { count: members.length })}</h2>
        {!isOwner && <p className="text-sm text-muted">{t("members.ownerOnly")}</p>}
        <ul className="divide-y divide-line rounded-theme border border-line" data-testid="member-list">
          {members.map((m) => {
            const lastOwner = m.role === "owner" && owners === 1;
            return (
              <li key={m.user_id} className="flex flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 flex-1 break-all font-medium">
                  {m.email}
                  {m.user_id === user.id && <span className="font-normal text-muted"> ({t("members.you")})</span>}
                </span>
                {isOwner && !lastOwner ? (
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
                    <RoleForm action={changeRole.bind(null, locale)} userId={m.user_id} role={m.role} label={t("members.roleFor", { email: m.email })} />
                    <ConfirmForm
                      action={removeMember.bind(null, locale)}
                      fields={{ user_id: m.user_id }}
                      trigger={t("members.remove")}
                      triggerLabel={t("members.removeFor", { email: m.email })}
                      title={t("members.removeTitle")}
                      body={t("members.removeBody", { email: m.email, org: org.name })}
                      confirm={t("members.remove")}
                    />
                  </div>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium">{t(`roles.${m.role}`)}</span>
                    {isOwner && lastOwner && <span className="text-xs text-muted">{t("members.lastOwner")}</span>}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isOwner && (
        <section className="flex flex-col gap-3 glass p-4" aria-labelledby="pending-h">
          <h2 id="pending-h" className="text-lg font-semibold">{t("pending.title")}</h2>
          {invites.error ? (
            <p role="alert" className="text-sm text-danger">{t("errors.generic")}</p>
          ) : !invites.data?.length ? (
            <p className="text-sm text-muted">{t("pending.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-3" data-testid="pending-list">
              {(invites.data as Invite[]).map((i) => {
                const expired = new Date(i.expires_at) < now;
                return (
                  <li key={i.id} className="flex flex-col gap-2 rounded-theme border border-line p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 break-all font-medium">{i.email}</span>
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium">{t(`roles.${i.role}`)}</span>
                    </div>
                    <p className={expired ? "text-danger" : "text-muted"}>
                      {expired ? t("pending.expired") : t("pending.expires", { date: fmt.dateTime(new Date(i.expires_at), { dateStyle: "medium" }) })}
                    </p>
                    {!expired && <CopyLink link={inviteUrl(base, locale, i.token)} />}
                    <ConfirmForm
                      action={revokeInvite.bind(null, locale)}
                      fields={{ id: i.id }}
                      trigger={t("pending.revoke")}
                      triggerLabel={t("pending.revokeFor", { email: i.email })}
                      title={t("pending.revokeTitle")}
                      body={t("pending.revokeBody", { email: i.email })}
                      confirm={t("pending.revoke")}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
