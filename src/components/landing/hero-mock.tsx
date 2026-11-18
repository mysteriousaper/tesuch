"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ScoreGauge } from "@/components/score-gauge";
import { IconCheck } from "./icons";

const SCORES = [52, 67, 81, 94];

/** Animated product mock: findings get fixed one by one and the readiness score climbs. Static with reduced motion. */
export function HeroMock() {
  const t = useTranslations("landing.hero");
  const c = useTranslations("common");
  const items = t.raw("mockItems") as string[];
  const [fixed, setFixed] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFixed(items.length);
      return;
    }
    let step = 0;
    const id = window.setInterval(() => {
      step = (step + 1) % (items.length + 2); // hold the finished state for one extra tick
      setFixed(Math.min(step, items.length));
    }, 1700);
    return () => window.clearInterval(id);
  }, [items.length]);

  return (
    <div className="relative" aria-hidden>
      <div
        className="pointer-events-none absolute -inset-x-2 -inset-y-8 -z-10 rounded-[3rem] opacity-70 blur-2xl sm:-inset-8"
        style={{ background: "radial-gradient(60% 60% at 70% 30%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%)" }}
      />
      <div className="rounded-theme-lg border border-line bg-surface p-5 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--ink)_35%,transparent)] sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{t("mockCompany")}</p>
            <p className="text-xs text-muted">{c("score")}</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium tabular-nums text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />
            02:00
          </span>
        </div>
        <div className="flex justify-center py-4">
          <ScoreGauge value={SCORES[fixed]} label={c("score")} size={190} />
        </div>
        <ul className="flex flex-col gap-2">
          {items.map((text, i) => {
            const done = i < fixed;
            return (
              <li
                key={text}
                className="flex items-center gap-3 rounded-theme border border-line px-3 py-2.5 text-sm transition-colors duration-500"
                style={{ background: done ? "color-mix(in oklab, var(--ok) 10%, var(--surface))" : "var(--surface)" }}
              >
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-all duration-500"
                  style={{
                    borderColor: done ? "var(--ok)" : "var(--advisory)",
                    background: done ? "var(--ok)" : "transparent",
                    color: done ? "var(--accent-ink)" : "var(--advisory)",
                  }}
                >
                  {done ? <IconCheck width={14} height={14} /> : <span className="text-[11px] font-bold">!</span>}
                </span>
                <span className={`min-w-0 flex-1 truncate transition-colors duration-500 ${done ? "text-muted line-through" : ""}`}>{text}</span>
                <span className={`shrink-0 text-xs font-semibold transition-opacity duration-500 ${done ? "text-ok opacity-100" : "opacity-0"}`}>
                  {t("mockFixed")}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
