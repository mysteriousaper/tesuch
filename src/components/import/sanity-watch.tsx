"use client";

// Live, non-blocking warnings under a form: reads the date and number fields of the surrounding <form>
// and shows what looks implausible (see lib/import/sanity). The form can still be saved.
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { sanityIssues, type SanityIssue } from "@/lib/import/sanity";

const todayIso = () => new Date().toISOString().slice(0, 10);

export function SanityWatch() {
  const t = useTranslations("import");
  const anchor = useRef<HTMLDivElement>(null);
  const [issues, setIssues] = useState<SanityIssue[]>([]);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const read = () => {
      const get = (name: string) => {
        const v = (form.elements.namedItem(name) as HTMLInputElement | null)?.value;
        return v ? v : null;
      };
      const days = get("days");
      setIssues(sanityIssues({ birthDate: get("birth_date"), startDate: get("start_date"), endDate: get("end_date"), probationEnd: get("probation_end"), leaveDays: days === null ? null : Number(days) }, todayIso()));
    };
    read();
    form.addEventListener("input", read);
    form.addEventListener("reset", () => setTimeout(read));
    return () => form.removeEventListener("input", read);
  }, []);

  return (
    <div ref={anchor} className="sm:col-span-full" aria-live="polite" data-testid="sanity-watch">
      {issues.length > 0 && (
        <ul className="list-inside list-disc rounded-theme border border-warn p-3 text-sm text-warn">
          {issues.map((i) => <li key={i.key}>⚠ {t(`sanity.${i.key}`)}</li>)}
        </ul>
      )}
    </div>
  );
}
