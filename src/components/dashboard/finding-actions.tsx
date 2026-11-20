"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { setFindingStatus } from "@/app/[locale]/app/actions";

type Status = "open" | "fixed" | "dismissed";

const primary = "whitespace-nowrap rounded-theme bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-60";
const secondary = "whitespace-nowrap rounded-theme border border-control px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-60";

function StatusButton({ locale, companyId, findingId, to, label, cls }: {
  locale: string; companyId: string; findingId: string; to: Status; label: string; cls: string;
}) {
  const t = useTranslations("dashboard");
  const [state, action, pending] = useActionState(setFindingStatus.bind(null, locale, companyId, findingId, to), null);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <button type="submit" disabled={pending} aria-busy={pending} className={cls}>
        {pending ? "…" : label}
      </button>
      {state && !state.ok && (
        <span role="status" aria-live="polite" className="text-xs text-danger">{t(`errors.${state.error}`)}</span>
      )}
    </form>
  );
}

/** Fix / dismiss for open findings, reopen for closed ones. Each button shows pending and error states. */
export function FindingActions({ locale, companyId, findingId, status }: { locale: string; companyId: string; findingId: string; status: Status }) {
  const t = useTranslations("dashboard");
  const common = { locale, companyId, findingId };
  return (
    <div className="flex items-start gap-2">
      {status === "open" ? (
        <>
          <StatusButton {...common} to="fixed" label={t("markFixed")} cls={primary} />
          <StatusButton {...common} to="dismissed" label={t("dismiss")} cls={secondary} />
        </>
      ) : (
        <StatusButton {...common} to="open" label={t("reopen")} cls={secondary} />
      )}
    </div>
  );
}
