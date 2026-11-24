import type { ReactNode } from "react";

export type GlassTone = "ok" | "warn" | "danger" | "neutral";
const colour: Record<GlassTone, string | undefined> = { ok: "var(--gd-teal)", warn: "var(--gd-ochre)", danger: "var(--gd-coral)", neutral: undefined };

/** Reference `Metric` tile. `highlight` gives the filled teal tile; otherwise the value takes the tone colour. */
export function GlassMetric({ label, icon, value, caption, tone = "neutral", highlight = false }: { label: string; icon?: ReactNode; value: ReactNode; caption?: ReactNode; tone?: GlassTone; highlight?: boolean }) {
  return (
    <article className="gd-metric" data-tone={highlight ? "teal" : undefined} data-gd-enter>
      <div className="gd-metric-head">
        <span>{label}</span>
        {icon && <span className="gd-metric-icon" aria-hidden="true">{icon}</span>}
      </div>
      <strong className="gd-metric-value" style={highlight ? undefined : { color: colour[tone] }}>{value}</strong>
      {caption && <div className="gd-metric-caption"><span>{caption}</span></div>}
    </article>
  );
}
