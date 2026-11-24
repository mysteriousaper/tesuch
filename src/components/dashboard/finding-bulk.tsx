"use client";

import { useTranslations } from "next-intl";
import { useActionState, useTransition } from "react";
import { bulkSetFindingStatus } from "@/app/[locale]/app/actions";

export const BULK_FORM_ID = "bulk-findings";

/**
 * Bulk bar for the open findings list. The checkboxes live in the list items and join this form through their `form` attribute,
 * so the list itself stays a server component. Dismissing needs a reason; fixing does not.
 */
export function FindingBulkBar({ locale, companyId }: { locale: string; companyId: string }) {
  const t = useTranslations("dashboard");
  const [state, action, actionPending] = useActionState(bulkSetFindingStatus.bind(null, locale, companyId), null);
  const [, start] = useTransition();
  const pending = actionPending;
  return (
    <form
      id={BULK_FORM_ID}
      // Submitted by hand instead of `action=`: React resets a form after its action, which would clear the ticked boxes after an error.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        start(() => action(data));
      }}
      aria-label={t("findingBulk.title")} className="flex flex-col gap-2 border-b border-line bg-surface-2 px-4 py-3 text-sm">
      <p className="text-xs text-muted">{t("findingBulk.hint")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <button name="status" value="fixed" disabled={pending} className="min-h-11 rounded-full bg-accent px-3 text-xs font-semibold text-accent-ink disabled:opacity-60">{t("findingBulk.fixed")}</button>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium">
          {t("findingBulk.reason")}
          <input name="reason" maxLength={500} autoComplete="off" className="min-h-11 rounded-full border border-control bg-surface px-3 text-sm" />
        </label>
        <button name="status" value="dismissed" disabled={pending} className="min-h-11 rounded-full border border-control bg-surface px-3 text-xs font-medium hover:bg-surface-2 disabled:opacity-60">{t("findingBulk.dismiss")}</button>
      </div>
      <p role="status" aria-live="polite" className="text-xs">
        {state?.ok && <span className="text-ok">{t("findingBulk.done", { count: state.count ?? 0 })}</span>}
        {state && !state.ok && <span className="text-danger">{t(`errors.${state.error}`)}</span>}
      </p>
    </form>
  );
}
