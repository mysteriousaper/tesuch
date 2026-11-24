import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type GlassTone = "ok" | "warn" | "danger" | "neutral";
export const toneText: Record<GlassTone, string> = { ok: "text-ok", warn: "text-warn", danger: "text-danger", neutral: "text-ink" };

/** Small stat card: label + icon, a big value, a caption (after the reference's `Metric`). */
export function GlassMetric({ label, icon, value, caption, tone = "neutral", className }: { label: string; icon?: ReactNode; value: ReactNode; caption?: ReactNode; tone?: GlassTone; className?: string }) {
  return (
    <article className={cn("glass flex flex-col gap-2 p-4", className)} data-glass-enter>
      <div className="flex items-center justify-between gap-2 text-sm text-muted">
        <span>{label}</span>
        {icon && <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-surface-2 text-ink">{icon}</span>}
      </div>
      <strong className={cn("text-3xl font-extrabold tabular-nums", toneText[tone])}>{value}</strong>
      {caption && <div className="text-sm text-muted">{caption}</div>}
    </article>
  );
}
