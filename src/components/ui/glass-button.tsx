import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type GlassButtonVariant = "solid" | "glass" | "ghost";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const variants: Record<GlassButtonVariant, string> = {
  solid: "bg-accent text-accent-ink hover:opacity-90",
  glass: "border border-control bg-surface text-ink hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
};

/** Class string for links styled as buttons (`<Link className={glassButtonClass("solid")}>`). */
export function glassButtonClass(variant: GlassButtonVariant = "glass", className?: string): string {
  return cn(base, variants[variant], className);
}

export function GlassButton({ variant = "glass", className, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: GlassButtonVariant }) {
  return <button type={type} className={glassButtonClass(variant, className)} {...rest} />;
}
