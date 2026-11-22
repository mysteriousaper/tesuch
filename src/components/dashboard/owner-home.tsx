import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDate, ruleById, rulesReviewedLine, type Locale } from "@/lib/notify/i18n";
import type { Readiness } from "@/lib/readiness";
import type { OwnerSnapshot } from "./owner-home-data";
import { CoverageNote } from "@/components/coverage-note";
import { daysSince, isStale } from "@/lib/import/sanity";
import { coverage } from "@/lib/rules/coverage";
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
export async function OwnerHome({ locale, company, snapshot, telegramLinked, assisted }: { locale: string; company: { id: string; name: string }; snapshot: OwnerSnapshot; telegramLinked: boolean; assisted?: React.ReactNode }) {
  const t = await getTranslations("owner");
  const tone = TONE[snapshot.status];
  const today = new Date().toISOString().slice(0, 10);
  const stale = isStale(snapshot.dataUpdatedAt, today) ? daysSince(snapshot.dataUpdatedAt, today) : null;
  const cov = coverage(locale as Locale);
  const pack = `/api/pdf/checklist?company=${company.id}&locale=${locale}&pack=1`;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-lg font-semibold text-muted">{company.name}</h1>

      <section className={`flex flex-col gap-2 rounded-theme-lg border-2 bg-surface p-6 ${tone.border}`} aria-labelledby="status-h">
        <p id="status-h" className={`flex items-center gap-3 text-3xl font-bold sm:text-4xl ${tone.text}`}>
          <span aria-hidden="true" className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-current text-2xl">{tone.icon}</span>
          <span data-testid="readiness-status" data-status={snapshot.status}>{t(`status.${snapshot.status}`)}</span>
        </p>
        <p className="text-base">{t(`hint.${snapshot.status}`)}</p>
        {snapshot.score !== null && <p className="text-sm text-muted">{t("score", { score: snapshot.score })}</p>}
        {snapshot.dataUpdatedAt && <p className="text-sm text-muted" data-testid="data-updated">{t("dataAge", { date: formatDate(snapshot.dataUpdatedAt.slice(0, 10)) })}</p>}
        {stale !== null && (
          <p role="note" className="mt-1 rounded-theme border border-warn p-3 text-sm" data-testid="data-stale">
            {t("dataAgeNudge", { days: stale })} <Link href="/app/import" className="font-semibold text-accent underline">{t("dataAgeCta")}</Link>
          </p>
        )}
      </section>

      {snapshot.status !== "none" && (
        <CoverageNote titles={cov.titles} summary={t("coverage.summary", { n: cov.count })} listLabel={t("coverage.list")} note={t("coverage.note")} reviewed={rulesReviewedLine(locale as Locale)} />
      )}

      {(snapshot.status === "none" || !telegramLinked) && (
        <OnboardingSteps staffAdded={snapshot.status !== "none"} telegramLinked={telegramLinked} assisted={assisted} />
      )}

      {snapshot.status !== "none" && (
        <section className="rounded-theme-lg border border-line bg-surface p-4" aria-labelledby="tasks-h">
          <h2 id="tasks-h" className="mb-3 text-lg font-semibold">{t("tasksTitle")}</h2>
          {snapshot.tasks.length === 0 ? (
            <p className="text-muted">{t("noTasks")}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {snapshot.tasks.map((task, i) => (
                <li key={task.key} className="flex gap-3">
                  <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold">{i + 1}</span>
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
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-theme-lg border border-line bg-surface p-4">
        <a href={pack} download data-testid="inspector-here" className="inline-flex min-h-14 items-center justify-center rounded-theme bg-accent px-6 py-4 text-center text-lg font-bold text-accent-ink">
          {t("inspector")}
        </a>
        <p className="text-sm text-muted">{t("inspectorHint")}</p>
      </section>

      <p className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href={`/app/companies/${company.id}`} className="text-accent underline">{t("details")}</Link>
        <Link href="/app?view=firm" className="text-accent underline">{t("allCompanies")}</Link>
      </p>
    </div>
  );
}
