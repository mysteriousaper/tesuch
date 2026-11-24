import { ArrowDownToLine, ArrowRight, ClipboardCheck, Gauge, ListChecks, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHead } from "@/components/ui/glassy-dashboard";
import { GlassMetric } from "@/components/ui/glass-metric";
import { GlassSection } from "@/components/ui/glass-section";
import { Link } from "@/i18n/navigation";
import { formatDate, ruleById, rulesReviewedLine, type Locale } from "@/lib/notify/i18n";
import type { Readiness } from "@/lib/readiness";
import type { OwnerSnapshot } from "./owner-home-data";
import { CoverageNote } from "@/components/coverage-note";
import { daysSince, isStale } from "@/lib/import/sanity";
import { coverage } from "@/lib/rules/coverage";
import { CHECKLIST, checklistCoverage, documentGroups } from "@/lib/rules/checklist";
import { DocumentsReady } from "./documents-ready";
import { OnboardingSteps } from "./onboarding-steps";

const TONE: Record<Readiness, { panel: string; text: string; icon: string }> = {
  clear: { panel: "", text: "text-ok", icon: "✓" },
  attention: { panel: "", text: "text-warn", icon: "!" },
  risk: { panel: "", text: "text-danger", icon: "✕" },
  none: { panel: "", text: "text-muted", icon: "＋" },
};

/**
 * Home for an owner who runs one business: one big status in words (colour is never the only signal),
 * at most three things to do this week, and the "Inspector is here" download.
 */
export async function OwnerHome({ locale, company, snapshot, telegramLinked, assisted, ticked = [], canEdit = false }: { locale: string; company: { id: string; name: string }; snapshot: OwnerSnapshot; telegramLinked: boolean; assisted?: React.ReactNode; /** Checklist items the company marked "we have it". */ ticked?: string[]; canEdit?: boolean }) {
  const t = await getTranslations("owner");
  const tone = TONE[snapshot.status];
  const today = new Date().toISOString().slice(0, 10);
  const stale = isStale(snapshot.dataUpdatedAt, today) ? daysSince(snapshot.dataUpdatedAt, today) : null;
  const cov = coverage(locale as Locale);
  const pack = `/api/pdf/checklist?company=${company.id}&locale=${locale}&pack=1`;
  const cl = checklistCoverage();
  const tasksTone = snapshot.tasks.some((k) => k.overdue) ? "danger" : snapshot.tasks.length ? "warn" : "ok";
  return (
    <>
      <PageHead
        title={company.name}
        description={t(`hint.${snapshot.status}`)}
        actions={
          <>
            <Link href={`/app/companies/${company.id}`} className="gd-secondary">{t("details")}<ArrowRight aria-hidden="true" /></Link>
            <Link href="/app?view=firm" className="gd-secondary">{t("allCompanies")}</Link>
          </>
        }
      />

      <div className="gd-command-grid">
        <section className={`gd-panel gd-balance ${tone.panel}`} aria-labelledby="status-h" data-gd-enter>
          <header className="gd-panel-head">
            <div><h2>{t("status.title")}</h2></div>
            {snapshot.score !== null && <span className="gd-unit">{t("score", { score: snapshot.score })}</span>}
          </header>
          <p id="status-h" className={`flex items-center gap-3 text-2xl font-extrabold tracking-tight sm:text-3xl ${tone.text}`}>
            <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-current text-xl">{tone.icon}</span>
            <span data-testid="readiness-status" data-status={snapshot.status}>{t(`status.${snapshot.status}`)}</span>
          </p>
          <p className="mt-3 text-sm text-muted">{t(`hint.${snapshot.status}`)}</p>
          {snapshot.dataUpdatedAt && <p className="gd-balance-change" data-testid="data-updated">{t("dataAge", { date: formatDate(snapshot.dataUpdatedAt.slice(0, 10)) })}</p>}
          {stale !== null && (
            <p role="note" className="mt-3 rounded-theme border border-warn p-3 text-sm" data-testid="data-stale">
              {t("dataAgeNudge", { days: stale })} <Link href="/app/import" className="font-semibold underline">{t("dataAgeCta")}</Link>
            </p>
          )}
          <div className="gd-balance-actions" style={{ gridTemplateColumns: "1fr" }}>
            <a href={pack} download data-testid="inspector-here" className="gd-primary" style={{ minBlockSize: 52, fontSize: 15 }}>
              {t("inspector")} <ArrowDownToLine aria-hidden="true" />
            </a>
          </div>
          <p className="text-xs text-muted">{t("inspectorHint")}</p>
        </section>

        {snapshot.status !== "none" ? (
          <div className="gd-summary">
            <GlassMetric highlight label={t("metrics.score")} icon={<Gauge />} value={snapshot.score ?? "–"} caption="/ 100" />
            <GlassMetric label={t("metrics.tasks")} icon={<ListChecks />} value={snapshot.tasks.length} tone={tasksTone} />
            <GlassMetric label={t("metrics.checklist")} icon={<ClipboardCheck />} value={cl.checked} caption={t("metrics.of", { total: cl.total })} />
            <GlassMetric label={t("metrics.rules")} icon={<ShieldCheck />} value={cov.count} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <OnboardingSteps staffAdded={false} telegramLinked={telegramLinked} assisted={assisted} />
          </div>
        )}

        {snapshot.status !== "none" && (
          <GlassSection id="tasks-h" title={t("tasksTitle")} className="self-start">
            {snapshot.tasks.length === 0 ? (
              <p className="gd-empty">{t("noTasks")}</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {snapshot.tasks.map((task, i) => (
                  <li key={task.key} className="gd-approval-content">
                    <span className="gd-list-icon" aria-hidden="true">{i + 1}</span>
                    <div>
                      <strong>{ruleById(task.ruleId).title[locale as Locale]}</strong>
                      <small>
                        {task.employee ? `${task.employee} · ` : ""}
                        {t(task.overdue ? "overdue" : "due", { date: formatDate(task.dueDate) })}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </GlassSection>
        )}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {snapshot.status !== "none" && !telegramLinked && <OnboardingSteps staffAdded telegramLinked={false} assisted={assisted} />}
        {snapshot.status !== "none" && (
          <DocumentsReady
            locale={locale as Locale} companyId={company.id} initialTicked={ticked} canEdit={canEdit}
            groups={documentGroups().map((g) => ({ ...g, label: CHECKLIST.groups[g.group]?.[locale as Locale] ?? g.group }))}
          />
        )}
        <div className="flex flex-col gap-3">
          {snapshot.status !== "none" && (
            <CoverageNote titles={cov.titles} summary={t("coverage.summary", { n: cov.count })} listLabel={t("coverage.list")} note={t("coverage.note")} reviewed={rulesReviewedLine(locale as Locale)} />
          )}
          <p className="px-1 text-sm text-muted" data-testid="checklist-coverage">{t("coverage.checklist", checklistCoverage())}</p>
        </div>
      </div>
    </>
  );
}
