import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Reference `Panel`: glass card with a header row (title, subtitle, action). */
export function GlassSection({ title, subtitle, action, id, className, children, ...rest }: { title: string; subtitle?: string; action?: ReactNode; id?: string; className?: string; children: ReactNode } & { "data-testid"?: string }) {
  return (
    <section aria-labelledby={id} className={cn("gd-panel", className)} data-gd-enter {...rest}>
      <header className="gd-panel-head">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
