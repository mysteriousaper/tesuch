import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Rounded top bar: brand on the start side, actions on the end side. */
export function PillTopBar({ brand, children, className }: { brand: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <header className={cn("glass flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 !rounded-full px-4 py-1.5 sm:px-5", className)}>
      <div className="flex min-w-0 items-center gap-2.5 font-bold">{brand}</div>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">{children}</div>
    </header>
  );
}
