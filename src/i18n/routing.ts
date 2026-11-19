import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["hy", "ru", "en"],
  defaultLocale: "hy",
  // Armenian is the default for everyone; users switch language explicitly (QA D-3).
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
