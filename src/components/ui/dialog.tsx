"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Modal on the native <dialog>: focus trap, Esc to close and inert background come from the browser. */
export function GlassDialog({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      className={cn("glass m-auto w-[min(32rem,calc(100%-2rem))] bg-surface p-6 text-ink backdrop:bg-black/40", className)}
    >
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </dialog>
  );
}
