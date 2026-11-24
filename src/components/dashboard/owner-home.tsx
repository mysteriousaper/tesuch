import { ClipboardCheck, Gauge, ListChecks } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { glassButtonClass } from "@/components/ui/glass-button";
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

const TONE: Record<Readiness, { border: string; text: string; icon: string }> = {
  clear: { border: "border-ok", text: "text-ok", icon: "✓" },
  attention: { border: "border-warn", text: "text-warn", icon: "!" },
  risk: { border: "border-danger", text: "text-danger", icon: "✕" },
  none: { border: "border-line", text: "text-muted", icon: "＋" },
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
    <div className="flex flex-col gap-5">
      <h1 className="px-1 text-lg font-semibold text-muted">{company.name}</h1>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <section className={`glass flex flex-col gap-3 border-2 p-6 ${tone.border}`} aria-labelledby="status-h" data-glass-enter>
            <p id="status-h" className={`flex items-center gap-3 text-3xl font-bold sm:text-4xl ${tone.text}`}>
              <span aria-hidden="true" className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-current text-2xl">{tone.icon}</span>
              <span data-testid="readiness-status" data-status={snapshot.status}>{t(`status.${snapshot.status}`)}</span>
            </p>
            <p className="text-base">{t(`hint.${snapshot.status}`)}</p>
            {snapshot.score !== null && <p className="text-sm text-muted">{t("score", { score: snapshot.score })}</p>}
            {snapshot.dataUpdatedAt && <p className="text-sm text-muted" data-testid="data-updated">{t("dataAge", { date: formatDate(snapshot.dataUpdatedAt.slice(0, 10)) })}</p>}
            {stale !== null && (
              <p role="note" className="rounded-theme border border-warn p-3 text-sm" data-testid="data-stale">
                {t("dataAgeNudge", { days: stale })} <Link href="/app/import" className="font-semibold text-accent underline">{t("dataAgeCta")}</Link>
              </p>
            )}
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-4">
              <a href={pack} download data-testid="inspector-here" className={glassButtonClass("solid", "min-h-14 px-6 py-4 text-center text-lg font-bold")}>
                {t("inspector")}
              </a>
              <p className="text-sm text-muted">{t("inspectorHint")}</p>
            </div>
          </section>

          {snapshot.status !== "none" && (
            <div className="grid gap-5 sm:grid-cols-3">
              <GlassMetric label={t("metrics.score")} icon={<Gauge className="size-4" />} value={snapshot.score ?? "–"} caption="/ 100" tone={snapshot.status === "clear" ? "ok" : snapshot.status === "risk" ? "danger" : "warn"} />
              <GlassMetric label={t("metrics.tasks")} icon={<ListChecks className="size-4" />} value={snapshot.tasks.length} tone={tasksTone} />
              <GlassMetric label={t("metrics.checklist")} icon={<ClipboardCheck className="size-4" />} value={cl.checked} caption={t("metrics.of", { total: cl.total })} />
            </div>
          )}

          {snapshot.status !== "none" && (
            <CoverageNote titles={cov.titles} summary={t("coverage.summary", { n: cov.count })} listLabel={t("coverage.list")} note={t("coverage.note")} reviewed={rulesReviewedLine(locale as Locale)} />
          )}
          <p className="px-1 text-sm text-muted" data-testid="checklist-coverage">{t("coverage.checklist", checklistCoverage())}</p>
        </div>

        <div className="flex flex-col gap-5">
          {(snapshot.status === "none" || !telegramLinked) && (
            <OnboardingSteps staffAdded={snapshot.status !== "none"} telegramLinked={telegramLinked} assisted={assisted} />
          )}

          {snapshot.status !== "none" && (
            <GlassSection id="tasks-h" title={t("tasksTitle")}>
              {snapshot.tasks.length === 0 ? (
                <p className="text-muted">{t("noTasks")}</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {snapshot.tasks.map((task, i) => (
                    <li key={task.key} className="flex gap-3">
                      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="font-medium">{ruleById(task.ruleId).title[locale as Locale]}</p>
                        <p className="text-sm text-muted">
                          {task.employee ? `${task.employee} · ` : ""}
                          {t(task.overdue ? "overdue" : "due", { date: formatDate(task.dueDate) })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </GlassSection>
          )}

          {snapshot.status !== "none" && (
            <DocumentsReady
              locale={locale as Locale} companyId={company.id} initialTicked={ticked} canEdit={canEdit}
              groups={documentGroups().map((g) => ({ ...g, label: CHECKLIST.groups[g.group]?.[locale as Locale] ?? g.group }))}
            />
          )}

          <p className="flex flex-wrap gap-x-6 gap-y-2 px-1 text-sm">
            <Link href={`/app/companies/${company.id}`} className="text-accent underline">{t("details")}</Link>
            <Link href="/app?view=firm" className="text-accent underline">{t("allCompanies")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
