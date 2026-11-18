import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";
import { LogoMark } from "./icons";

const SECTIONS = ["how", "firms", "trust", "faq"] as const;

/** Public site header. `sections` shows in-page anchors (landing only). */
export async function SiteHeader({ sections = false }: { sections?: boolean }) {
  const t = await getTranslations("landing.nav");
  const c = await getTranslations("common");
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 backdrop-blur-md" style={{ background: "color-mix(in oklab, var(--bg) 82%, transparent)" }}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-bold" aria-label={c("appName")}>
          <LogoMark width={30} height={30} />
          <span className="text-lg">{c("appName")}</span>
        </Link>
        {sections && (
          <nav aria-label={t("menu")} className="hidden items-center gap-1 text-sm xl:flex">
            {SECTIONS.map((s) => (
              <a key={s} href={`#${s}`} className="whitespace-nowrap rounded-theme px-3 py-2 text-muted transition-colors hover:text-ink">
                {t(s)}
              </a>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LocaleSwitcher />
          </div>
          <Link href="/login" className="hidden whitespace-nowrap rounded-theme px-3 py-2 text-sm font-medium text-muted hover:text-ink md:inline-block">
            {t("login")}
          </Link>
          <Link href="/check" className="whitespace-nowrap rounded-theme bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink transition-transform hover:-translate-y-px">
            {t("check")}
          </Link>
        </div>
      </div>
    </header>
  );
}
