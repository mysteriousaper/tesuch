import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { todayIso } from "@/components/dashboard/queries";
import { emailsFor, orgSession } from "@/components/members/server";
import { Link, redirect } from "@/i18n/navigation";
import {
  groupRows, inboxSearch, pageCount, pageRange, parseInboxQuery, windowEnd, type InboxQuery, type InboxRow,
} from "@/lib/inbox/filters";
import { RULES } from "@/lib/rules/catalog";
import { supabaseForUser } from "@/lib/supabase/server";
import { AssignSelect, type Assignable } from "./assign-select";
import { InboxFilters } from "./filters";

export const dynamic = "force-dynamic";

type UserClient = Awaited<ReturnType<typeof supabaseForUser>>;
type Sev = InboxRow["severity"];

interface Row extends InboxRow {
  company_id: string;
  employee_id: string;
  rule_id: string;
  companies: { name: string } | null;
  employees: { full_name: string } | null;
}

const CHIP: Record<Sev, string> = {
  red: "bg-danger text-accent-ink border-danger",
  amber: "border-warn text-warn",
  advisory: "border-advisory text-advisory",
  info: "border-line text-muted",
};
const BASE_COLS = "id, company_id, employee_id, rule_id, severity, due_date, companies(name), employees(full_name)";

/** Same filters for the page query and the exact count. Info findings never show; only open ones do. */
/** Minimal view of a PostgREST builder (the full generic type is too deep for tsc when the column list is a variable). */
interface Filterable extends PromiseLike<{ data: unknown[] | null; count: number | null; error: { message: string } | null }> {
  eq(column: string, value: unknown): Filterable;
  neq(column: string, value: unknown): Filterable;
  lte(column: string, value: unknown): Filterable;
  is(column: string, value: null): Filterable;
  order(column: string, opts: { ascending: boolean }): Filterable;
  range(from: number, to: number): Filterable;
}
const findings = (supabase: UserClient) => supabase.from("findings") as unknown as {
  select(columns: string, opts?: { count: "exact"; head: true }): Filterable;
};
function applyFilters<Q extends Filterable>(q0: Q, orgId: string, q: InboxQuery, today: string, me: string, withAssignee: boolean): Q {
  let query = q0.eq("org_id", orgId).eq("status", "open").neq("severity", "info");
  const end = windowEnd(today, q.window);
  if (end) query = query.lte("due_date", end);
  if (q.company) query = query.eq("company_id", q.company);
  if (q.severity !== "all") query = query.eq("severity", q.severity);
  if (withAssignee && q.assignee === "me") query = query.eq("assignee_id", me);
  if (withAssignee && q.assignee === "unassigned") query = query.is("assignee_id", null);
  return query as Q;
}

/**
 * One page of rows (range paging: the API caps a response at 1000 rows) plus the exact total from a head count.
 * If the assignee_id column does not exist yet (migration 20261121100000 not applied) it falls back to selecting without it.
 */
async function load(supabase: UserClient, orgId: string, q: InboxQuery, today: string, me: string) {
  const [from, to] = pageRange(q.page);
  let withAssignee = true;
  const read = (cols: string, assignee: boolean) =>
    applyFilters(findings(supabase).select(cols), orgId, q, today, me, assignee)
      .order("due_date", { ascending: true }).order("id", { ascending: true }).range(from, to);
  let res = await read(`${BASE_COLS}, assignee_id`, true);
  if (res.error) {
    withAssignee = false;
    res = await read(BASE_COLS, false);
  }
  const count = await applyFilters(findings(supabase).select("id", { count: "exact", head: true }), orgId, q, today, me, withAssignee);
  return {
    rows: (res.data ?? []) as unknown as Row[],
    total: count.count ?? 0,
    failed: Boolean(res.error || count.error),
    withAssignee,
  };
}

export default async function InboxPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user, org } = await orgSession();
  if (!user) return redirect({ href: "/login", locale });
  const t = await getTranslations("inbox");
  const c = await getTranslations("common");
  const fmt = await getFormatter();

  if (!org) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("noOrg")}</p>
      </div>
    );
  }

  const q = parseInboxQuery(await searchParams);
  const today = todayIso();
  const canEdit = org.role === "owner" || org.role === "accountant";
  const [{ rows: raw, total, failed, withAssignee }, companiesRes, membersRes] = await Promise.all([
    load(supabase, org.id, q, today, user.id),
    supabase.from("companies").select("id, name").eq("org_id", org.id).order("name").range(0, 999),
    supabase.from("memberships").select("user_id, role").eq("org_id", org.id).in("role", ["owner", "accountant"]),
  ]);
  const companies = (companiesRes.data ?? []) as { id: string; name: string }[];
  const editors = (membersRes.data ?? []).map((m) => m.user_id as string);
  const emails = withAssignee ? await emailsFor([...editors, ...raw.flatMap((r) => (r.assignee_id ? [r.assignee_id] : []))]) : new Map<string, string>();
  const options: Assignable[] = editors.map((id) => ({ id, label: id === user.id ? `${emails.get(id) ?? "—"} (${t("assignees.me")})` : emails.get(id) ?? "—" }));

  const pages = pageCount(total);
  const { overdue, upcoming } = groupRows(raw, today);
  const groups = [
    { key: "overdue", title: t("overdueGroup"), rows: overdue },
    { key: "upcoming", title: t("upcomingGroup"), rows: upcoming },
  ].filter((g) => g.rows.length > 0);
  const filtered = q.window !== "all" || q.company || q.severity !== "all" || q.assignee !== "any";

  const title = (r: Row) => {
    const rule = RULES.find((x) => x.id === r.rule_id);
    return rule ? rule.title[locale as "hy" | "ru" | "en"] ?? rule.title.en : r.rule_id;
  };
  const chip = (r: Row) => <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${CHIP[r.severity]}`}>{c(`severity.${r.severity}`)}</span>;
  const assigneeCell = (r: Row) => {
    if (!withAssignee) return null;
    if (canEdit) {
      return <AssignSelect locale={locale} findingId={r.id} value={r.assignee_id ?? null} options={options} label={t("assignLabel", { rule: title(r), employee: r.employees?.full_name ?? "" })} />;
    }
    return r.assignee_id ? <span className="break-all">{emails.get(r.assignee_id) ?? "—"}</span> : <span className="text-muted">{t("unassigned")}</span>;
  };
  const dueCell = (r: Row) => <time dateTime={r.due_date}>{fmt.dateTime(new Date(`${r.due_date}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" })}</time>;
  const href = (page: number) => `/app/inbox${inboxSearch(q, page)}` as `/app/inbox`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted">{t("intro", { org: org.name })}</p>
      </div>

      <InboxFilters query={q} companies={companies} showAssignee={withAssignee} />

      {failed ? (
        <p role="alert" className="text-sm text-danger">{t("error")}</p>
      ) : total === 0 ? (
        <p className="rounded-theme border border-line bg-surface p-6 text-center text-sm text-muted">{filtered ? t("emptyFiltered") : t("empty")}</p>
      ) : (
        <>
          <p className="text-sm text-muted" role="status" data-testid="inbox-total">{t("total", { count: total })}</p>

          {/* Cards on phones. */}
          <div className="flex flex-col gap-4 md:hidden">
            {groups.map((g) => (
              <section key={g.key} aria-labelledby={`m-${g.key}`} className="flex flex-col gap-2">
                <h2 id={`m-${g.key}`} className={`text-sm font-bold ${g.key === "overdue" ? "text-danger" : ""}`}>{g.title}{g.key === "overdue" && <span className="ml-2 font-normal text-muted">{t("overdueCount", { count: g.rows.length })}</span>}</h2>
                <ul className="flex flex-col gap-2">
                  {g.rows.map((r) => (
                    <li key={r.id} data-testid="inbox-row" className="flex flex-col gap-2 rounded-theme border border-line bg-surface p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{dueCell(r)}</span>
                        {chip(r)}
                      </div>
                      <p className="font-medium">{title(r)}</p>
                      <p className="text-muted">
                        <Link href={`/app/companies/${r.company_id}`} className="inline-flex min-h-11 items-center underline">{r.companies?.name ?? "—"}</Link>
                        {" · "}
                        <Link href={`/app/companies/${r.company_id}/employees/${r.employee_id}`} className="inline-flex min-h-11 items-center underline">{r.employees?.full_name ?? "—"}</Link>
                      </p>
                      {assigneeCell(r)}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {/* Table from md up. */}
          <div className="hidden overflow-x-auto glass md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t("caption")}</caption>
              <thead className="bg-surface-2 text-xs uppercase text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">{t("cols.due")}</th>
                  <th scope="col" className="px-3 py-2">{t("cols.company")}</th>
                  <th scope="col" className="px-3 py-2">{t("cols.employee")}</th>
                  <th scope="col" className="px-3 py-2">{t("cols.rule")}</th>
                  <th scope="col" className="px-3 py-2">{t("cols.status")}</th>
                  {withAssignee && <th scope="col" className="px-3 py-2">{t("cols.assignee")}</th>}
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.key} className="divide-y divide-line border-t border-line" data-testid={`inbox-group-${g.key}`}>
                  <tr className="bg-surface-2">
                    <th scope="colgroup" colSpan={withAssignee ? 6 : 5} className={`px-3 py-2 text-left text-xs font-bold ${g.key === "overdue" ? "text-danger" : ""}`}>
                      {g.title}{g.key === "overdue" && <span className="ml-2 font-normal text-muted">{t("overdueCount", { count: g.rows.length })}</span>}
                    </th>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.id} data-testid="inbox-row">
                      <th scope="row" className="whitespace-nowrap px-3 py-2 font-medium">{dueCell(r)}</th>
                      <td className="px-3 py-1"><Link href={`/app/companies/${r.company_id}`} className="inline-flex min-h-11 items-center underline">{r.companies?.name ?? "—"}</Link></td>
                      <td className="px-3 py-1"><Link href={`/app/companies/${r.company_id}/employees/${r.employee_id}`} className="inline-flex min-h-11 items-center underline">{r.employees?.full_name ?? "—"}</Link></td>
                      <td className="px-3 py-2">{title(r)}</td>
                      <td className="px-3 py-2">{chip(r)}</td>
                      {withAssignee && <td className="min-w-48 px-3 py-1">{assigneeCell(r)}</td>}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          {/* Shown once per page: unverified rules are advisory only. */}
          {raw.some((r) => r.severity === "advisory") && <p className="text-xs text-muted">ⓘ {c("disclaimer")}</p>}
        </>
      )}

      {pages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-2 text-sm">
          {q.page > 1 ? <Link href={href(q.page - 1)} rel="prev" className="inline-flex min-h-11 items-center rounded-full border border-control px-3 hover:bg-surface-2">← {t("prev")}</Link> : <span />}
          <span className="text-muted">{t("page", { page: q.page, pages })}</span>
          {q.page < pages ? <Link href={href(q.page + 1)} rel="next" className="inline-flex min-h-11 items-center rounded-full border border-control px-3 hover:bg-surface-2">{t("next")} →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
