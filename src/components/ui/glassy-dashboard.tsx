"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FileText, Inbox, LayoutDashboard, ListChecks, ScrollText, Search, Settings, Upload, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { Link, usePathname } from "@/i18n/navigation";
import "./glassy.css";

gsap.registerPlugin(useGSAP);

// Adapted from the owner's reference (docs/design/reference/glassy-dashboard.tsx): same frame, top pill with ask bar,
// side rail dock + bottom dock, big page headline. Data and views are ours; navigation is real routes.
const NAV = [
  { href: "/app", key: "dashboard", icon: LayoutDashboard },
  { href: "/app/inbox", key: "inbox", icon: Inbox },
  { href: "/app/import", key: "import", icon: Upload },
  { href: "/app/documents", key: "documents", icon: FileText },
  { href: "/app/quiz", key: "quiz", icon: ListChecks },
  { href: "/app/members", key: "members", icon: Users },
  { href: "/app/audit", key: "audit", icon: ScrollText },
  { href: "/app/settings", key: "settings", icon: Settings },
] as const;

/** Follows the app's colour mode: html[data-mode], else the OS preference. */
function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const mode = html.getAttribute("data-mode");
      setDark(mode === "dark" || (mode !== "light" && media.matches));
    };
    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ["data-mode"] });
    media.addEventListener("change", update);
    update();
    return () => { observer.disconnect(); media.removeEventListener("change", update); };
  }, []);
  return dark;
}

function Dock({ side = false }: { side?: boolean }) {
  const t = useTranslations("app.nav");
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" || pathname.startsWith("/app/companies") : pathname.startsWith(href));

  useEffect(() => {
    const container = nav.current;
    const indicator = marker.current;
    if (!container || !indicator) return;
    const adjust = () => {
      const current = container.querySelector<HTMLElement>('[aria-current="page"]');
      if (!current) { indicator.removeAttribute("data-ready"); return; }
      indicator.style.width = `${current.offsetWidth}px`;
      indicator.style.height = `${current.offsetHeight}px`;
      indicator.style.transform = `translate(${current.offsetLeft}px, ${current.offsetTop}px)`;
      indicator.dataset.ready = "true";
    };
    const observer = new ResizeObserver(adjust);
    observer.observe(container);
    container.querySelectorAll("a").forEach((link) => observer.observe(link));
    adjust();
    return () => observer.disconnect();
  }, [pathname]);

  function onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    const links = Array.from(nav.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    const next: number | undefined =
      e.key === "Home" ? 0 : e.key === "End" ? links.length - 1
        : e.key === (side ? "ArrowDown" : "ArrowRight") ? i + 1
        : e.key === (side ? "ArrowUp" : "ArrowLeft") ? i - 1 : undefined;
    if (next === undefined) return;
    e.preventDefault();
    links[(next + links.length) % links.length]?.focus();
  }

  return (
    <nav ref={nav} onKeyDown={onKeyDown} className={side ? "gd-dock gd-dock-side" : "gd-dock gd-dock-bottom"} aria-label="App">
      <span ref={marker} className="gd-dock-indicator" aria-hidden="true" />
      {NAV.map(({ href, key, icon: Icon }) => (
        <Link key={href} href={href} aria-label={t(key)} aria-current={isActive(href) ? "page" : undefined}>
          <Icon aria-hidden="true" />
          {!side && <span className="gd-dock-text" aria-hidden="true">{t(key)}</span>}
          {side && <span className="gd-dock-tip" aria-hidden="true">{t(key)}</span>}
        </Link>
      ))}
    </nav>
  );
}

/** The workspace frame. `actions` sit in the top pill (colour mode, language, sign out). */
export function GlassyShell({ brand, actions, children, footer }: { brand: string; actions: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const t = useTranslations("app.shell");
  const dark = useDarkMode();
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from("[data-gd-enter]", { y: 16, opacity: 0, stagger: 0.045, duration: 0.5, ease: "power3.out", clearProps: "transform,opacity" });
    },
    { scope: root },
  );
  return (
    <div className="gd-app" data-theme={dark ? "dark" : "light"} ref={root} style={{ "--gd-panel-frost": "12px" } as React.CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="gd-background" src="/glass-bg.jpg" alt="" aria-hidden="true" fetchPriority="high" />
      <div className="gd-surround">
        <header className="gd-top">
          <div className="gd-brand">
            <span className="gd-logo" aria-hidden="true">
              <svg viewBox="0 0 28 28" fill="none"><path d="m5 22 7.4-16h3.2L23 22h-4l-5-11.4L9 22H5Z" fill="currentColor" /><path d="M10 18h8l1.4 3h-10.8l1.4-3Z" fill="currentColor" opacity=".55" /></svg>
            </span>
            <div><strong>{brand}</strong><small>{t("workspace")}</small></div>
          </div>
          <Link href="/app/inbox" className="gd-ask">
            <span className="gd-orb" aria-hidden="true" />
            <span className="gd-prompt">{t("ask")}</span>
            <Search aria-hidden="true" className="gd-ask-search" />
          </Link>
          <div className="gd-top-actions">{actions}</div>
        </header>
        <div className="gd-stage-wrap">
          <Dock side />
          <main className="gd-stage">
            <div className="gd-stage-scroll">{children}</div>
          </main>
          <Dock />
        </div>
        {footer && <footer className="gd-footer">{footer}</footer>}
      </div>
    </div>
  );
}

/** Big page headline with optional actions (reference `gd-view-head`). */
export function PageHead({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="gd-view-head" data-gd-enter>
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="gd-view-actions">{actions}</div>}
    </header>
  );
}
