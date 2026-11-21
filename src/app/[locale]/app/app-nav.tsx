"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

// Shared navigation. Each feature team owns its page under src/app/[locale]/app/<section>/.
const ITEMS = [
  { href: "/app", key: "dashboard" },
  { href: "/app/inbox", key: "inbox" },
  { href: "/app/import", key: "import" },
  { href: "/app/documents", key: "documents" },
  { href: "/app/quiz", key: "quiz" },
  { href: "/app/members", key: "members" },
  { href: "/app/audit", key: "audit" },
  { href: "/app/settings", key: "settings" },
] as const;

export function AppNav() {
  const t = useTranslations("app.nav");
  const pathname = usePathname();
  return (
    <nav aria-label="App" className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm [mask-image:linear-gradient(to_right,#000_88%,transparent)] sm:mx-0 sm:px-0 sm:[mask-image:none]">
      {ITEMS.map((i) => {
        const active = i.href === "/app" ? pathname === "/app" || pathname.startsWith("/app/companies") : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-theme px-3 py-2 ${active ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
          >
            {t(i.key)}
          </Link>
        );
      })}
    </nav>
  );
}
