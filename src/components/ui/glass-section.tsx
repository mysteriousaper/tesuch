import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Panel with a header row (title, optional subtitle, optional action), after the reference's `Panel`. */
export function GlassSection({ title, subtitle, action, id, className, children, ...rest }: { title: string; subtitle?: string; action?: ReactNode; id?: string; className?: string; children: ReactNode } & { "data-testid"?: string }) {
  return (
    <section aria-labelledby={id} className={cn("glass flex flex-col gap-4 p-5", className)} data-glass-enter {...rest}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id={id} className="text-base font-bold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
