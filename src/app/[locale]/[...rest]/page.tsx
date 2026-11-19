import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

/** Path that deliberately throws, so e2e can check the error boundary shows no internals. Off in production. */
const ERROR_PROBE = "platform-error-probe";

/**
 * Catch-all for unknown paths under a locale. Without it Next falls back to the root not-found page, which has
 * no locale and no translations; routing them here renders the localized [locale]/not-found.tsx with status 404.
 */
export default async function UnknownPath({ params }: { params: Promise<{ locale: string; rest: string[] }> }) {
  const { locale, rest } = await params;
  setRequestLocale(locale);
  if (rest.length === 1 && rest[0] === ERROR_PROBE && process.env.VERCEL_ENV !== "production") {
    // The fake secret lets the test prove the message never reaches the page.
    throw new Error("error-probe: SECRET_PROBE_do_not_render");
  }
  notFound();
}
