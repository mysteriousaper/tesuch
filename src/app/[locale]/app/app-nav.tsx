"use client";

import { FileText, Inbox, LayoutDashboard, ListChecks, ScrollText, Settings, Upload, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Dock } from "@/components/ui/dock";

// Shared navigation. Each feature team owns its page under src/app/[locale]/app/<section>/.
const ITEMS = [
  { href: "/app", key: "dashboard", icon: LayoutDashboard },
  { href: "/app/inbox", key: "inbox", icon: Inbox },
  { href: "/app/import", key: "import", icon: Upload },
  { href: "/app/documents", key: "documents", icon: FileText },
  { href: "/app/quiz", key: "quiz", icon: ListChecks },
  { href: "/app/members", key: "members", icon: Users },
  { href: "/app/audit", key: "audit", icon: ScrollText },
  { href: "/app/settings", key: "settings", icon: Settings },
] as const;

export function AppNav() {
  const t = useTranslations("app.nav");
  const pathname = usePathname();
  const items = ITEMS.map((i) => ({
    href: i.href,
    label: t(i.key),
    icon: i.icon,
    active: i.href === "/app" ? pathname === "/app" || pathname.startsWith("/app/companies") : pathname.startsWith(i.href),
  }));
  return <Dock items={items} label="App" />;
}
