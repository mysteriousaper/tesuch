import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConfirmForm } from "@/components/members/forms";
import { orgSession } from "@/components/members/server";
import { Link, redirect } from "@/i18n/navigation";
import { deleteEmployee } from "../actions";

export const dynamic = "force-dynamic";

const LIMIT = 50;

/** Data rights: export one employee's data, erase an employee, export the whole org. */
export default async function DataRightsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user, org } = await orgSession();
  if (!user) return redirect({ href: "/login", locale });
  const t = await getTranslations("members.data");
  const m = await getTranslations("members");

  if (!org) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{m("noOrg")}</p>
      </div>
    );
  }

  const raw = (await searchParams).q;
  // Only letters, digits, spaces and a few name characters reach the ilike pattern.
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 100);
  let query = supabase.from("employees").select("id, full_name, companies(name)").eq("org_id", org.id).order("full_name").limit(LIMIT + 1);
  if (q) query = query.ilike("full_name", `%${q}%`);
  const { data, error } = await query;
  const rows = (data ?? []).slice(0, LIMIT).map((e) => ({
    id: e.id as string, name: e.full_name as string, company: (e.companies as unknown as { name: string } | null)?.name ?? "",
  }));
  const canEdit = org.role !== "viewer";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/app/members" className="text-sm text-muted hover:text-ink">← {m("title")}</Link>
        <h1 className="mt-1 text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted">{t("intro")}</p>
      </div>

      {org.role === "owner" && (
        <section className="flex flex-col gap-2 rounded-theme-lg border border-line bg-surface p-4" aria-labelledby="org-export-h">
          <h2 id="org-export-h" className="text-lg font-semibold">{t("orgExport")}</h2>
          <p className="text-sm text-muted">{t("orgExportHint")}</p>
          <a href={`/${locale}/app/members/data/export`} download className="self-start rounded-theme bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink">
            {t("orgExportButton")}
          </a>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-theme-lg border border-line bg-surface p-4" aria-labelledby="emp-h">
        <h2 id="emp-h" className="text-lg font-semibold">{t("employees")}</h2>
        <form className="flex flex-col gap-2 sm:flex-row sm:items-end" role="search">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            {t("search")}
            <input name="q" defaultValue={q} maxLength={100} className="w-full rounded-theme border border-control bg-surface px-3 py-2.5 text-base" />
          </label>
          <button className="rounded-theme border border-control bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface-2">{t("find")}</button>
        </form>
        {!canEdit && <p className="text-sm text-muted">{t("viewerNote")}</p>}
        {error ? (
          <p role="alert" className="text-sm text-danger">{m("errors.generic")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">{q ? t("noMatch") : t("empty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-theme border border-line" data-testid="employee-list">
            {rows.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block break-words font-medium">{e.name}</span>
                  <span className="block text-xs text-muted">{e.company}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/${locale}/app/members/data/employees/${e.id}`}
                    download
                    aria-label={t("exportFor", { name: e.name })}
                    className="rounded-theme border border-control bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2"
                  >
                    {t("export")}
                  </a>
                  {canEdit && (
                    <ConfirmForm
                      action={deleteEmployee.bind(null, locale)}
                      fields={{ employee_id: e.id }}
                      trigger={t("delete")}
                      triggerLabel={t("deleteFor", { name: e.name })}
                      title={t("deleteTitle")}
                      body={t("deleteBody", { name: e.name })}
                      confirm={t("deleteConfirm")}
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {(data?.length ?? 0) > LIMIT && <p className="text-sm text-muted">{t("more", { count: LIMIT })}</p>}
      </section>
    </div>
  );
}
