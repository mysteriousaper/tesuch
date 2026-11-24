import type { ReactNode } from "react";
import type { GlassTone } from "./glass-metric";

const state: Record<GlassTone, string> = { ok: "teal", warn: "ink", danger: "coral", neutral: "ink" };

/** Reference status pill. The label is always text, so colour is never the only signal. */
export function GlassBadge({ tone = "neutral", children }: { tone?: GlassTone; children: ReactNode }) {
  return (
    <span className="gd-status" data-state={state[tone]}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
