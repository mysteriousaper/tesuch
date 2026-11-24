import { cn } from "@/lib/utils";

/** Horizontal meter (reference `gd-capacity-track`). Exposes role="meter" with the numbers. */
export function GlassMeter({ value, max, label, tone = "ok", className }: { value: number; max: number; label: string; tone?: "ok" | "warn" | "danger"; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = { ok: "bg-ok", warn: "bg-warn", danger: "bg-danger" }[tone];
  return (
    <div role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className={cn("h-2.5 overflow-hidden rounded-full bg-surface-2", className)}>
      <span className={cn("block h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}
