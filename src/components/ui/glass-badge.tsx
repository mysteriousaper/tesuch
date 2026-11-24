import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { toneText, type GlassTone } from "./glass-metric";

/** Status pill. The label is always text, so colour is never the only signal. */
export function GlassBadge({ tone = "neutral", children, className }: { tone?: GlassTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-semibold", toneText[tone], className)}>
      <i aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
