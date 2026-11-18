import { useTranslations } from "next-intl";
import { fmtDate } from "./finding-list";

export interface TimelineEvent {
  date: string;
  label: string;
  tone: "neutral" | "accent" | "warn" | "danger" | "ok";
  detail?: string;
}

const DOT: Record<TimelineEvent["tone"], string> = {
  neutral: "bg-muted",
  accent: "bg-accent",
  warn: "bg-warn",
  danger: "bg-danger",
  ok: "bg-ok",
};

/** Vertical timeline, oldest first, with a "today" marker between past and future events. */
export function Timeline({ events, today }: { events: TimelineEvent[]; today: string }) {
  const t = useTranslations("dashboard");
  if (!events.length) return <p className="px-4 py-6 text-center text-sm text-muted">{t("noEvents")}</p>;
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const cut = sorted.findIndex((e) => e.date > today);
  const items: (TimelineEvent | "today")[] = cut === -1 ? [...sorted, "today"] : [...sorted.slice(0, cut), "today", ...sorted.slice(cut)];

  return (
    <ol className="relative ml-4 border-l-2 border-line py-2">
      {items.map((e, i) =>
        e === "today" ? (
          <li key="today" className="relative -ml-[9px] flex items-center gap-3 py-2" aria-current="date">
            <span className="h-4 w-4 rounded-full border-2 border-accent bg-surface" aria-hidden />
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-ink">{t("today")} · {fmtDate(today)}</span>
          </li>
        ) : (
          <li key={i} className={`relative -ml-[7px] flex gap-3 py-2 ${e.date > today ? "" : "opacity-80"}`}>
            <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${DOT[e.tone]}`} aria-hidden />
            <div className="flex flex-col">
              <time dateTime={e.date} className="text-xs text-muted tabular-nums">{fmtDate(e.date)}</time>
              <span className="text-sm font-medium">{e.label}</span>
              {e.detail && <span className="text-xs text-muted">{e.detail}</span>}
            </div>
          </li>
        ),
      )}
    </ol>
  );
}
