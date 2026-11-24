import { format, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { FindingActions } from "./finding-actions";
import { BULK_FORM_ID, FindingBulkBar } from "./finding-bulk";
import { findingsHref, groupByRule, SEVERITIES, type FindingParams } from "./finding-query";
import { Link } from "@/i18n/navigation";
import { RULES } from "@/lib/rules/catalog";
import type { EffectiveSeverity } from "@/lib/rules/types";

export interface FindingView {
  id: string;
  rule_id: string;
  severity: EffectiveSeverity;
  due_date: string;
  status: "open" | "fixed" | "dismissed";
  employee_id: string;
  employee_name: string;
}

const CHIP: Record<EffectiveSeverity, string> = {
  red: "bg-danger text-accent-ink border-danger",
  amber: "border-warn text-warn",
  advisory: "border-advisory text-advisory",
  info: "border-line text-muted",
};
export const fmtDate = (iso: string) => format(parseISO(iso), "dd.MM.yyyy");

function FindingItem({ f, locale, companyId, today, canEdit, showTitle = true }: { f: FindingView; locale: string; companyId: string; today: string; canEdit: boolean; showTitle?: boolean }) {
  const t = useTranslations("dashboard");
  const c = useTranslations("common");
  const rule = RULES.find((r) => r.id === f.rule_id);
  const title = rule ? rule.title[locale as "hy" | "ru" | "en"] : f.rule_id;
  const overdue = f.status === "open" && f.due_date < today;

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      {canEdit && f.status === "open" && (
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="ids" value={f.id} form={BULK_FORM_ID} className="h-5 w-5" />
          {t("findingBulk.select")}
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full border px-2 py-0.5 font-semibold ${CHIP[f.severity]}`}>{c(`severity.${f.severity}`)}</span>
        {overdue && <span className="rounded-full bg-danger px-2 py-0.5 font-semibold text-accent-ink">{c("overdue")}</span>}
        {f.status !== "open" && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">{t(`status.${f.status}`)}</span>}
        <span className="text-muted">
          {rule?.article ? c("article", { n: rule.article }) : c("articlePending")}
          {rule && (
            <> · <a href={rule.source_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">arlis.am</a></>
          )}
        </span>
      </div>
      {showTitle && <p className={`font-medium ${f.status !== "open" ? "text-muted line-through" : ""}`}>{title}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted">
          <Link href={`/app/companies/${companyId}/employees/${f.employee_id}`} className="underline hover:text-ink">{f.employee_name}</Link>
          {" · "}{c("due", { date: fmtDate(f.due_date) })}
          {canEdit && f.status === "open" && (
            <>
              {" · "}
              <Link href={`/app/companies/${companyId}/employees/${f.employee_id}#edit`} className="font-medium text-accent underline hover:text-ink">
                {t("editData")}
              </Link>
            </>
          )}
        </span>
        {canEdit && <FindingActions locale={locale} companyId={companyId} findingId={f.id} status={f.status} />}
      </div>
    </li>
  );
}

export interface FindingListProps {
  /** Open findings of the current page, already filtered and ordered (severity, then due date). */
  open: FindingView[];
  /** Total open findings matching the filter (all pages). */
  total: number;
  closed: FindingView[];
  closedTotal: number;
  params: FindingParams;
  pages: number;
  locale: string;
  companyId: string;
  today: string;
  canEdit: boolean;
}

export function FindingList({ open, total, closed, closedTotal, params, pages, locale, companyId, today, canEdit }: FindingListProps) {
  const t = useTranslations("dashboard");
  const c = useTranslations("common");
  const groups = groupByRule(open);
  const filtered = params.sev !== null || params.q !== "";
  return (
    <div>
      <form method="get" className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3" role="search" aria-label={t("findingFilters.label")}>
        <label className="flex flex-col gap-1 text-xs font-medium">
          {t("findingFilters.severity")}
          <select name="sev" defaultValue={params.sev ?? ""} className="min-h-11 rounded-full border border-control bg-surface px-2 text-sm">
            <option value="">{t("findingFilters.all")}</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{c(`severity.${s}`)}</option>)}
          </select>
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium">
          {t("findingFilters.employee")}
          <input name="q" type="search" defaultValue={params.q} maxLength={60} autoComplete="off" className="min-h-11 rounded-full border border-control bg-surface px-3 text-sm" />
        </label>
        <button type="submit" className="min-h-11 rounded-full border border-control bg-surface px-4 text-sm font-medium hover:bg-surface-2">{t("findingFilters.apply")}</button>
        {filtered && <Link href={`/app/companies/${companyId}${findingsHref({})}`} className="min-h-11 content-center text-sm text-accent underline">{t("findingFilters.clear")}</Link>}
      </form>
      {canEdit && total > 0 && <FindingBulkBar locale={locale} companyId={companyId} />}
      {canEdit && total > 0 && (
        <p className="border-b border-line bg-surface-2 px-4 py-2 text-xs text-muted">ⓘ {t("reopenHint")}</p>
      )}
      {open.length ? (
        <div className="divide-y divide-line">
          {groups.map((g) => {
            const rule = RULES.find((r) => r.id === g.ruleId);
            return (
              <section key={g.ruleId} aria-label={rule ? rule.title[locale as "hy" | "ru" | "en"] : g.ruleId}>
                <h3 className="bg-surface-2 px-4 py-2 text-sm font-semibold">
                  {rule ? rule.title[locale as "hy" | "ru" | "en"] : g.ruleId} <span className="font-normal text-muted">({g.items.length})</span>
                </h3>
                <ul className="divide-y divide-line">
                  {g.items.map((f) => <FindingItem key={f.id} f={f} locale={locale} companyId={companyId} today={today} canEdit={canEdit} showTitle={false} />)}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className={`px-4 py-8 text-center ${filtered ? "text-muted" : "text-ok"}`}>{filtered ? t("findingFilters.none") : t("noFindings")}</p>
      )}
      {pages > 1 && (
        <nav aria-label={t("findingFilters.pages")} className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
          {params.page > 1 ? <Link href={`/app/companies/${companyId}${findingsHref({ ...params, page: params.page - 1 })}`} className="min-h-11 content-center text-accent underline" rel="prev">{t("findingFilters.prev")}</Link> : <span />}
          <span className="text-muted">{t("findingFilters.pageOf", { page: params.page, pages, total })}</span>
          {params.page < pages ? <Link href={`/app/companies/${companyId}${findingsHref({ ...params, page: params.page + 1 })}`} className="min-h-11 content-center text-accent underline" rel="next">{t("findingFilters.next")}</Link> : <span />}
        </nav>
      )}
      {/* Shown once per list: every unverified rule is advisory only. */}
      {open.some((f) => f.severity === "advisory") && (
        <p className="border-t border-line px-4 py-2 text-xs text-muted">ⓘ {c("disclaimer")}</p>
      )}
      {closedTotal > 0 && (
        <details className="border-t border-line">
          <summary className="cursor-pointer px-4 py-3 text-sm text-muted">{t("showClosed", { count: closedTotal })}</summary>
          <ul className="divide-y divide-line">
            {closed.map((f) => <FindingItem key={f.id} f={f} locale={locale} companyId={companyId} today={today} canEdit={canEdit} />)}
          </ul>
          {closedTotal > closed.length && <p className="px-4 py-2 text-xs text-muted">{t("findingFilters.closedCap", { shown: closed.length, total: closedTotal })}</p>}
        </details>
      )}
    </div>
  );
}
