import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Link } from "@/i18n/navigation";
import { LogoMark } from "./icons";

export async function SiteFooter() {
  const t = await getTranslations("landing");
  const c = await getTranslations("common");
  const lg = await getTranslations("legal.related");
  const g = await getTranslations("guide");
  const tr = await getTranslations("trust");
  return (
    <footer className="px-2 pb-4 pt-6 sm:px-4">
      <div className="glass mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:px-8 md:grid-cols-[1fr_auto]">
        <div className="flex max-w-2xl flex-col gap-3">
          <div className="flex items-center gap-2.5 font-bold">
            <LogoMark width={26} height={26} />
            {c("appName")}
          </div>
          <p className="text-sm leading-relaxed text-muted">{t("footer.disclaimer")}</p>
          <p className="text-xs text-muted">© {new Date().getFullYear()} {c("appName")} · {t("footer.made")}</p>
        </div>
        <div className="flex flex-col items-start gap-3 text-sm md:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <ModeToggle />
            <LocaleSwitcher />
          </div>
          <Link href="/guide" className="inline-block py-1 text-muted hover:text-ink">{g("footerLink")}</Link>
          <Link href="/security" className="inline-block py-1 text-muted hover:text-ink">{tr("footerLink")}</Link>
          <Link href="/check-file" className="inline-block py-1 text-muted hover:text-ink">{t("nav.checkFile")}</Link>
          <Link href="/check" className="inline-block py-1 text-muted hover:text-ink">{t("nav.check")}</Link>
          <Link href="/login" className="inline-block py-1 text-muted hover:text-ink">{t("nav.login")}</Link>
          <Link href="/privacy" className="inline-block py-1 text-muted hover:text-ink">{lg("privacy")}</Link>
          <Link href="/terms" className="inline-block py-1 text-muted hover:text-ink">{lg("terms")}</Link>
          <a href="https://www.arlis.am/" rel="noopener noreferrer" target="_blank" className="inline-block py-1 text-muted hover:text-ink">arlis.am ↗</a>
        </div>
      </div>
    </footer>
  );
}
