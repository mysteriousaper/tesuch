"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABEL = { hy: "Հայ", ru: "Рус", en: "Eng" } as const;

export function LocaleSwitcher() {
  const pathname = usePathname();
  const current = useLocale();
  return (
    <nav aria-label="Language" className="flex gap-1 text-sm">
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          aria-current={l === current ? "true" : undefined}
          className={`rounded-theme px-2.5 py-1.5 ${l === current ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:text-ink"}`}
        >
          {LABEL[l]}
        </Link>
      ))}
    </nav>
  );
}
