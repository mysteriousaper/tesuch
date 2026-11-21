"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ScoreGauge } from "./score-gauge";

export interface PreviewFinding {
  title: string;
  article: string | null;
  due: string;
  overdue: boolean;
  company: string;
}

const COMPANIES = [
  { name: "Դեմո Լոգիստիկ ՍՊԸ", staff: 42, open: 5, score: 46 },
  { name: "Դեմո Կլինիկա ՍՊԸ", staff: 18, open: 2, score: 72 },
  { name: "Դեմո Բեյքերի ՍՊԸ", staff: 11, open: 1, score: 88 },
  { name: "Դեմո Արտ ՍՊԸ", staff: 7, open: 0, score: 100 },
];

function tone(score: number) {
  return score >= 80 ? "bg-ok" : score >= 50 ? "bg-warn" : "bg-danger";
}

export function ThemePreview({ theme, n, findings }: { theme: "official" | "fintech" | "warm"; n: number; findings: PreviewFinding[] }) {
  const t = useTranslations("themes");
  const c = useTranslations("common");
  const [dark, setDark] = useState(false);
  const [fixed, setFixed] = useState<Set<number>>(new Set());

  return (
    <section
      data-theme={theme}
      data-mode={dark ? "dark" : "light"}
      aria-labelledby={`theme-${theme}`}
      className="flex flex-col gap-4 rounded-theme-lg border border-line bg-bg p-4 text-ink transition-colors sm:p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("option", { n })}</p>
          <h2 id={`theme-${theme}`} className="text-xl font-bold">
            {t(`${theme}.name`)}
          </h2>
          <p className="text-sm text-muted">{t(`${theme}.desc`)}</p>
        </div>
        <div role="group" aria-label="Theme mode" className="flex shrink-0 rounded-theme border border-line bg-surface p-0.5 text-xs">
          {[false, true].map((d) => (
            <button
              key={String(d)}
              type="button"
              aria-pressed={dark === d}
              onClick={() => setDark(d)}
              className={`rounded-theme px-2.5 py-1.5 font-medium ${dark === d ? "bg-accent text-accent-ink" : "text-muted"}`}
            >
              {d ? t("dark") : t("light")}
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center justify-between gap-4 rounded-theme-lg border border-line bg-surface p-4">
        <ScoreGauge value={77} label={t("firmScore")} size={150} />
        <div className="flex flex-col items-end gap-2 text-right">
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ok">🔥 {t("streak", { count: 3 })}</span>
          <span className="text-xs text-muted">{t("demoNote")}</span>
        </div>
      </div>

      <div className="rounded-theme-lg border border-line bg-surface">
        <h3 className="flex items-baseline justify-between border-b border-line px-4 py-3 text-sm font-semibold">
          {t("companies")} <span className="text-xs font-normal text-muted">{t("sortedByScore")} ↑</span>
        </h3>
        <ul>
          {COMPANIES.map((co) => (
            <li key={co.name} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 last:border-0">
              <span className="truncate text-sm font-medium">{co.name}</span>
              <span className="text-sm font-bold tabular-nums">{co.score}</span>
              <span className="text-xs text-muted">
                {t("employees", { count: co.staff })} · {t("openFindings", { count: co.open })}
              </span>
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <span className={`block h-full ${tone(co.score)}`} style={{ width: `${co.score}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-theme-lg border border-line bg-surface">
        <h3 className="border-b border-line px-4 py-3 text-sm font-semibold">{t("fixThisWeek")}</h3>
        <ul>
          {findings.map((f, i) => (
            <li key={i} className={`flex flex-col gap-2 border-b border-line px-4 py-3 last:border-0 ${fixed.has(i) ? "opacity-50" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-advisory px-2 py-0.5 font-semibold text-advisory">{c("severity.advisory")}</span>
                {f.overdue && <span className="rounded-full bg-danger px-2 py-0.5 font-semibold text-accent-ink">{c("overdue")}</span>}
                <span className="text-muted">{f.article ? c("article", { n: f.article }) : c("articlePending")}</span>
              </div>
              <p className={`text-sm font-medium ${fixed.has(i) ? "line-through" : ""}`}>{f.title}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">
                  {f.company} · {c("due", { date: f.due })}
                </span>
                <button
                  type="button"
                  onClick={() => setFixed((s) => new Set(s).add(i))}
                  disabled={fixed.has(i)}
                  className="shrink-0 whitespace-nowrap rounded-theme bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-60"
                >
                  {t("markFixed")}
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-2 text-xs text-muted">ⓘ {c("disclaimer")}</p>
      </div>
    </section>
  );
}
