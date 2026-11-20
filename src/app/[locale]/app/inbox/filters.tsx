"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ASSIGNEES, DEFAULT_QUERY, inboxSearch, SEVERITIES, WINDOWS, type InboxQuery } from "@/lib/inbox/filters";

const selectCls = "min-h-11 rounded-theme border border-control bg-surface px-3 text-base";

/** Filter bar. Changing a control updates the URL (page resets to 1); the server page re-reads the query. */
export function InboxFilters({ query, companies, showAssignee }: {
  query: InboxQuery; companies: { id: string; name: string }[]; showAssignee: boolean;
}) {
  const t = useTranslations("inbox");
  const c = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  const set = (patch: Partial<InboxQuery>) => {
    const next = { ...query, ...patch, page: 1 };
    start(() => router.replace(`${pathname}${inboxSearch(next)}`));
  };
  const dirty = query.window !== DEFAULT_QUERY.window || query.company || query.severity !== "all" || query.assignee !== "any";

  return (
    <form role="search" aria-label={t("filters")} aria-busy={pending} onSubmit={(e) => e.preventDefault()}
      className="grid grid-cols-1 gap-3 rounded-theme-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("window")}
        <select value={query.window} onChange={(e) => set({ window: e.target.value as InboxQuery["window"] })} className={selectCls}>
          {WINDOWS.map((w) => <option key={w} value={w}>{t(`windows.${w}`)}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("company")}
        <select value={query.company ?? ""} onChange={(e) => set({ company: e.target.value || null })} className={selectCls}>
          <option value="">{t("allCompanies")}</option>
          {companies.map((co) => <option key={co.id} value={co.id}>{co.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("severity")}
        <select value={query.severity} onChange={(e) => set({ severity: e.target.value as InboxQuery["severity"] })} className={selectCls}>
          <option value="all">{t("allSeverities")}</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{c(`severity.${s}`)}</option>)}
        </select>
      </label>
      {showAssignee && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("assignee")}
          <select value={query.assignee} onChange={(e) => set({ assignee: e.target.value as InboxQuery["assignee"] })} className={selectCls}>
            {ASSIGNEES.map((a) => <option key={a} value={a}>{t(`assignees.${a}`)}</option>)}
          </select>
        </label>
      )}
      {dirty && (
        <button type="button" onClick={() => set({ ...DEFAULT_QUERY })} className="min-h-11 self-end rounded-theme px-3 text-sm text-muted underline sm:col-span-2 lg:col-span-4 lg:justify-self-start">
          {t("reset")}
        </button>
      )}
    </form>
  );
}
