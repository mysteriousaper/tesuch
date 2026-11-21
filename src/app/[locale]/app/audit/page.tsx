import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AUDIT_ACTIONS, AUDIT_PAGE_SIZE, AUDIT_TABLES, auditHref, auditRange, parseAuditQuery } from "@/components/members/lib";
import { emailsFor, orgSession } from "@/components/members/server";
import { redirect } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

interface Row { id: number; at: string; actor: string | null; action: string; table_name: string; row_id: string | null }

const selectCls = "rounded-theme border border-control bg-surface px-3 py-2.5 text-base";

/** Owners only. RLS on audit_log already limits rows to orgs the caller owns; the role check here gives a clear message. */
export default async function AuditPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user, org } = await orgSession();
  if (!user) return redirect({ href: "/login", locale });
  const t = await getTranslations("audit");
  const fmt = await getFormatter();

  if (!org || org.role !== "owner") {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="rounded-theme border border-line bg-surface p-4 text-sm text-muted">{t("ownersOnly")}</p>
      </div>
    );
  }

  const q = parseAuditQuery(await searchParams);
  const [from, to] = auditRange(q.page);
  let query = supabase.from("audit_log").select("id, at, actor, action, table_name, row_id", { count: "exact" }).eq("org_id", org.id);
  if (q.table) query = query.eq("table_name", q.table);
  if (q.action) query = query.eq("action", q.action);
  const { data, count, error } = await query.order("at", { ascending: false }).order("id", { ascending: false }).range(from, to);
  const rows = (data ?? []) as Row[];
  const emails = await emailsFor(rows.flatMap((r) => (r.actor ? [r.actor] : [])));
  const pages = Math.max(1, Math.ceil((count ?? 0) / AUDIT_PAGE_SIZE));
  const tableLabel = (name: string) => ((AUDIT_TABLES as readonly string[]).includes(name) ? t(`tables.${name}`) : name);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted">{t("intro", { org: org.name })}</p>
      </div>

      <form className="flex flex-col gap-3 rounded-theme-lg border border-line bg-surface p-4 sm:flex-row sm:items-end" aria-label={t("filters")}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("table")}
          <select name="table" defaultValue={q.table ?? ""} className={selectCls}>
            <option value="">{t("all")}</option>
            {AUDIT_TABLES.map((n) => <option key={n} value={n}>{t(`tables.${n}`)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("action")}
          <select name="action" defaultValue={q.action ?? ""} className={selectCls}>
            <option value="">{t("all")}</option>
            {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{t(`actions.${a}`)}</option>)}
          </select>
        </label>
        <button className="rounded-theme bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink">{t("apply")}</button>
        {(q.table || q.action) && <a href="?" className="py-2.5 text-sm text-muted underline">{t("reset")}</a>}
      </form>

      {error ? (
        <p role="alert" className="text-sm text-danger">{t("error")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-theme border border-line bg-surface p-4 text-sm text-muted">{t("empty")}</p>
      ) : (
        <>
          {/* Cards on phones, a table from sm up. */}
          <ul className="flex flex-col gap-2 sm:hidden" aria-label={t("title")}>
            {rows.map((r) => (
              <li key={r.id} className="rounded-theme border border-line bg-surface p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{t(`actions.${r.action}` as "actions.insert")} · {tableLabel(r.table_name)}</span>
                  <time dateTime={r.at} className="text-muted">{fmt.dateTime(new Date(r.at), { dateStyle: "short", timeStyle: "short" })}</time>
                </div>
                <p className="break-all text-muted">{r.actor ? emails.get(r.actor) ?? r.actor : t("system")}</p>
                {r.row_id && <p className="break-all font-mono text-xs text-muted">{r.row_id}</p>}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-theme-lg border border-line bg-surface sm:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead className={`bg-surface-2 text-xs text-muted${locale === "hy" ? "" : " uppercase"}`}>
                <tr>
                  <th scope="col" className="px-3 py-2">{t("time")}</th>
                  <th scope="col" className="px-3 py-2">{t("actor")}</th>
                  <th scope="col" className="px-3 py-2">{t("action")}</th>
                  <th scope="col" className="px-3 py-2">{t("table")}</th>
                  <th scope="col" className="px-3 py-2">{t("row")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line" data-testid="audit-rows">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-3 py-2"><time dateTime={r.at}>{fmt.dateTime(new Date(r.at), { dateStyle: "short", timeStyle: "medium" })}</time></td>
                    <td className="max-w-[16rem] truncate px-3 py-2" title={r.actor ? emails.get(r.actor) : undefined}>{r.actor ? emails.get(r.actor) ?? r.actor : <span className="text-muted">{t("system")}</span>}</td>
                    <td className="px-3 py-2">{t(`actions.${r.action}` as "actions.insert")}</td>
                    <td className="px-3 py-2">{tableLabel(r.table_name)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">{r.row_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-2 text-sm">
          {q.page > 1 ? <a href={auditHref(q, q.page - 1)} rel="prev" className="rounded-theme border border-control px-3 py-2 hover:bg-surface-2">← {t("prev")}</a> : <span />}
          <span className="text-muted">{t("page", { page: q.page, pages })}</span>
          {q.page < pages ? <a href={auditHref(q, q.page + 1)} rel="next" className="rounded-theme border border-control px-3 py-2 hover:bg-surface-2">{t("next")} →</a> : <span />}
        </nav>
      )}
    </div>
  );
}
