"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/app/[locale]/app/dashboard-logic";

export const inputCls = "w-full rounded-theme border border-line bg-surface px-3 py-2.5 text-base text-ink";
export const labelCls = "flex flex-col gap-1 text-sm font-medium";
export const primaryBtn = "rounded-theme bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60";
export const secondaryBtn = "rounded-theme border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-2 disabled:opacity-60";

/**
 * Form bound to a server action returning ActionState. Shows pending, success and error states
 * (announced to screen readers) and resets fields after success.
 */
export function ActionForm({
  action, children, submitLabel, success, variant = "primary", className = "flex flex-col gap-3", resetOnSuccess = true,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submitLabel: string;
  /** Text shown on success; receives the optional count from the action. */
  success?: (count?: number) => string;
  variant?: "primary" | "secondary";
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const t = useTranslations("dashboard");
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className} aria-busy={pending}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={variant === "primary" ? primaryBtn : secondaryBtn}>
          {pending ? "…" : submitLabel}
        </button>
        <p role="status" aria-live="polite" className="text-sm">
          {state?.ok && state.info && <span className="text-muted">{t(`info.${state.info}`)}</span>}
          {state?.ok && !state.info && <span className="text-ok">{success ? success(state.count) : t("saved")}</span>}
          {state && !state.ok && <span className="text-danger">{t(`errors.${state.error}`)}</span>}
        </p>
      </div>
    </form>
  );
}
