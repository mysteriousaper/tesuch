import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "@/lib/utils";

type Props<T extends ElementType> = { as?: T; className?: string } & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

/** Frosted panel: translucent surface + blur + soft rim (see "Glass layer" in globals.css). Solid when transparency is reduced. */
export function GlassPanel<T extends ElementType = "div">({ as, className, ...rest }: Props<T>) {
  const Tag: ElementType = as ?? "div";
  return <Tag className={cn("glass p-5", className)} {...rest} />;
}
