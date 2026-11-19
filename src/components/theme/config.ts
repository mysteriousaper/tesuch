// App-wide theme settings. Token values live in design/tokens.json (mirrored in src/app/globals.css).

export const THEMES = ["official", "fintech", "warm"] as const;
export type Theme = (typeof THEMES)[number];

/** The theme the whole app renders with. Change here once the final design is picked. */
export const DEFAULT_THEME: Theme = "official";

/** "system" follows prefers-color-scheme; "light"/"dark" force a mode. */
export const MODES = ["system", "light", "dark"] as const;
export type Mode = (typeof MODES)[number];

/** Cookie holding an explicit light/dark choice. Absent = follow the OS. */
export const MODE_COOKIE = "tesuch-mode";
export const MODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseMode(value: string | null | undefined): Mode {
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * Runs in <head> before first paint: applies a saved light/dark choice so the page never flashes the
 * wrong mode. Static string (no user input is interpolated); the cookie value is matched against a
 * fixed pattern, so nothing from the cookie reaches the DOM except "light" or "dark".
 */
export const MODE_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${MODE_COOKIE}=(light|dark)(?:;|$)/);if(m)document.documentElement.setAttribute("data-mode",m[1]);}catch(e){}})();`;
