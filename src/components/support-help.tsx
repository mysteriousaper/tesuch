import { getTranslations } from "next-intl/server";
import { supportLinks } from "@/lib/support";

/** "Help" in the app header: mailto, plus the Telegram bot when configured. Renders nothing unless NEXT_PUBLIC_SUPPORT_EMAIL is set. */
export async function SupportHeaderLink() {
  const links = supportLinks(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME);
  if (!links) return null;
  const t = await getTranslations("common");
  return <a href="#help" className="inline-flex min-h-11 items-center py-1 text-sm text-muted hover:text-ink" data-testid="help-link">{t("support.help")}</a>;
}

/** Footer block with the contact links and the response-time promise. */
export async function SupportFooter() {
  const links = supportLinks(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME);
  if (!links) return null;
  const t = await getTranslations("common");
  return (
    <footer id="help" className="mt-6 border-t border-line py-4 text-sm text-muted" data-testid="support-footer">
      <p>
        <strong className="text-ink">{t("support.help")}:</strong>{" "}
        <a href={links.mailto} className="inline-flex min-h-11 items-center text-accent underline">{links.email}</a>
        {links.telegram && (
          <>
            {" · "}
            <a href={links.telegram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-accent underline">{t("support.telegram")}</a>
          </>
        )}
      </p>
      <p>{t("support.sla")}</p>
    </footer>
  );
}
