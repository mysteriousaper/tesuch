import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// One JSON file per feature namespace (messages/<locale>/<namespace>.json) so parallel work never edits the same file.
// Add a new namespace by creating the file in all three locales and listing it here.
export const NAMESPACES = ["common", "home", "themes", "auth", "onboarding", "notifications", "app", "dashboard", "import", "documents", "quiz", "landing", "check"] as const;

async function load(locale: string) {
  const parts = await Promise.all(
    NAMESPACES.map((ns) => import(`../../messages/${locale}/${ns}.json`).then((m) => m.default).catch(() => ({}))),
  );
  return Object.assign({}, ...parts);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: await load(locale) };
});
