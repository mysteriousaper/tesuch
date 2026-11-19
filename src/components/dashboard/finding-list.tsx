import { format, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { setFindingStatus } from "@/app/[locale]/app/actions";
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

const ORDER: EffectiveSeverity[] = ["red", "amber", "advisory", "info"];
const CHIP: Record<EffectiveSeverity, string> = {
  red: "bg-danger text-accent-ink border-danger",
  amber: "border-warn text-warn",
  advisory: "border-advisory text-advisory",
  info: "border-line text-muted",
};
export const fmtDate = (iso: string) => format(parseISO(iso), "dd.MM.yyyy");

function FindingItem({ f, locale, companyId, today, canEdit }: { f: FindingView; locale: string; companyId: string; today: string; canEdit: boolean }) {
  const t = useTranslations("dashboard");
  const c = useTranslations("common");
  const rule = RULES.find((r) => r.id === f.rule_id);
  const title = rule ? rule.title[locale as "hy" | "ru" | "en"] : f.rule_id;
  const overdue = f.status === "open" && f.due_date < today;
  const action = (status: FindingView["status"]) => setFindingStatus.bind(null, locale, companyId, f.id, status);

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
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
      <p className={`font-medium ${f.status !== "open" ? "text-muted line-through" : ""}`}>{title}</p>
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
        {canEdit && (
          <div className="flex gap-2">
            {f.status === "open" ? (
              <>
                <form action={action("fixed")}>
                  <button className="whitespace-nowrap rounded-theme bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink">{t("markFixed")}</button>
                </form>
                <form action={action("dismissed")}>
                  <button className="whitespace-nowrap rounded-theme border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2">{t("dismiss")}</button>
                </form>
              </>
            ) : (
              <form action={action("open")}>
                <button className="whitespace-nowrap rounded-theme border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2">{t("reopen")}</button>
              </form>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function FindingList({ findings, locale, companyId, today, canEdit }: { findings: FindingView[]; locale: string; companyId: string; today: string; canEdit: boolean }) {
  const t = useTranslations("dashboard");
  const c = useTranslations("common");
  const open = findings.filter((f) => f.status === "open").sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity) || a.due_date.localeCompare(b.due_date));
  const closed = findings.filter((f) => f.status !== "open");
  return (
    <div>
      {canEdit && open.length > 0 && (
        <p className="border-b border-line bg-surface-2 px-4 py-2 text-xs text-muted">ⓘ {t("reopenHint")}</p>
      )}
      {open.length ? (
        <ul className="divide-y divide-line">
          {open.map((f) => <FindingItem key={f.id} f={f} locale={locale} companyId={companyId} today={today} canEdit={canEdit} />)}
        </ul>
      ) : (
        <p className="px-4 py-8 text-center text-ok">{t("noFindings")}</p>
      )}
      {/* Shown once per list: every unverified rule is advisory only. */}
      {open.some((f) => f.severity === "advisory") && (
        <p className="border-t border-line px-4 py-2 text-xs text-muted">ⓘ {c("disclaimer")}</p>
      )}
      {closed.length > 0 && (
        <details className="border-t border-line">
          <summary className="cursor-pointer px-4 py-3 text-sm text-muted">{t("showClosed", { count: closed.length })}</summary>
          <ul className="divide-y divide-line">
            {closed.map((f) => <FindingItem key={f.id} f={f} locale={locale} companyId={companyId} today={today} canEdit={canEdit} />)}
          </ul>
        </details>
      )}
    </div>
  );
}
