"use client";

import { GlassMeter } from "@/components/ui/glass-meter";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setChecklistTick } from "@/app/[locale]/app/actions";
import type { ChecklistQuestion } from "@/lib/rules/checklist";

type Loc = "hy" | "ru" | "en";

/** "Documents to have ready": the checklist items Tesuch cannot check, as a tickable list. Viewers see it read-only. */
export function DocumentsReady({ locale, companyId, groups, initialTicked, canEdit }: {
  locale: Loc; companyId: string;
  groups: { group: string; label: string; items: ChecklistQuestion[] }[];
  initialTicked: string[]; canEdit: boolean;
}) {
  const t = useTranslations("owner.documents");
  const [ticked, setTicked] = useState(() => new Set(initialTicked));
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  const toggle = (no: string, on: boolean) => {
    setError(false);
    setTicked((prev) => { const next = new Set(prev); if (on) next.add(no); else next.delete(no); return next; });
    start(async () => {
      const r = await setChecklistTick(locale, companyId, no, on);
      if (!r?.ok) {
        setError(true);
        setTicked((prev) => { const next = new Set(prev); if (on) next.delete(no); else next.add(no); return next; });
      }
    });
  };

  return (
    <section className="glass p-5" aria-labelledby="docs-h" data-testid="documents-ready">
      <GlassMeter value={ticked.size} max={total} label={t("summary", { done: ticked.size, total })} className="mb-1" />
      <details>
        <summary id="docs-h" className="min-h-11 cursor-pointer py-2 text-lg font-semibold" data-testid="documents-summary">
          {t("summary", { done: ticked.size, total })}
        </summary>
        <p className="mt-1 text-sm text-muted">{t("hint")}</p>
        {!canEdit && <p className="mt-1 text-sm text-muted">{t("viewerNote")}</p>}
        {error && <p role="alert" className="mt-2 text-sm text-danger">{t("error")}</p>}
        <div className="mt-3 flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.group}>
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">{g.label}</h3>
              <ul className="flex flex-col">
                {g.items.map((q) => (
                  <li key={q.no}>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm">
                      <input
                        type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={ticked.has(q.no)} disabled={!canEdit || pending}
                        onChange={(e) => toggle(q.no, e.target.checked)} aria-label={`${t("ready")}: ${q.text[locale]}`} data-testid={`doc-${q.no}`}
                      />
                      <span><span className="text-muted">{q.no}. </span>{q.text[locale]}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
