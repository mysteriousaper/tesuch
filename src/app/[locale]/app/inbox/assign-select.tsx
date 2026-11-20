"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { assignFinding } from "./actions";

export interface Assignable { id: string; label: string }

/** Assignee picker for one finding. Owners and accountants only (the page does not render it for viewers). */
export function AssignSelect({ locale, findingId, value, options, label }: {
  locale: string; findingId: string; value: string | null; options: Assignable[]; label: string;
}) {
  const t = useTranslations("inbox");
  const [current, setCurrent] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onChange = (next: string) => {
    const before = current;
    setCurrent(next);
    setError(null);
    start(async () => {
      const r = await assignFinding(locale, findingId, next || null);
      if (!r.ok) {
        setCurrent(before);
        setError(r.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label={label}
        value={current}
        disabled={pending}
        aria-busy={pending}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-theme border border-control bg-surface px-2 text-sm"
      >
        <option value="">{t("unassigned")}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <span role="status" aria-live="polite" className="text-xs text-danger empty:hidden">{error ? t(`errors.${error}` as "errors.generic") : ""}</span>
    </div>
  );
}
