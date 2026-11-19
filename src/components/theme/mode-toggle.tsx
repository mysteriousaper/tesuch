"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { MODE_COOKIE, MODE_COOKIE_MAX_AGE, MODES, parseMode, type Mode } from "./config";

// Self-contained labels so the toggle can drop into any header without a translation namespace.
const LABELS: Record<string, { group: string } & Record<Mode, string>> = {
  hy: { group: "Գունային ռեժիմ", system: "Ինչպես սարքում", light: "Լուսավոր", dark: "Մութ" },
  ru: { group: "Цветовой режим", system: "Как в системе", light: "Светлая", dark: "Тёмная" },
  en: { group: "Colour mode", system: "Match system", light: "Light", dark: "Dark" },
};

const ICONS: Record<Mode, React.ReactNode> = {
  system: <path d="M4 5h16v11H4zM9 20h6M12 16v4" />,
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  dark: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />,
};

function apply(mode: Mode) {
  const html = document.documentElement;
  if (mode === "system") {
    html.removeAttribute("data-mode");
    document.cookie = `${MODE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  } else {
    html.setAttribute("data-mode", mode);
    document.cookie = `${MODE_COOKIE}=${mode}; Path=/; Max-Age=${MODE_COOKIE_MAX_AGE}; SameSite=Lax`;
  }
}

/** System / light / dark switch. The choice is stored in a cookie and applied before paint by MODE_SCRIPT. */
export function ModeToggle({ className = "" }: { className?: string }) {
  const l = LABELS[useLocale()] ?? LABELS.en;
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    setMode(parseMode(document.documentElement.getAttribute("data-mode")));
  }, []);

  return (
    <div role="group" aria-label={l.group} className={`inline-flex rounded-theme border border-line bg-surface p-0.5 ${className}`}>
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          aria-label={l[m]}
          title={l[m]}
          onClick={() => {
            apply(m);
            setMode(m);
          }}
          className={`grid h-7 w-7 place-items-center rounded-theme transition-colors ${mode === m ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {ICONS[m]}
          </svg>
        </button>
      ))}
    </div>
  );
}
