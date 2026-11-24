import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Pill input with a visible 3:1 border (WCAG 1.4.11). Always pair with a <label>. */
export function GlassInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("min-h-11 w-full rounded-full border border-control bg-surface px-4 text-sm text-ink placeholder:text-muted", className)}
      {...rest}
    />
  );
}
