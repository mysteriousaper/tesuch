"use client";

import type { ComponentType, KeyboardEvent, SVGProps } from "react";
import { useRef } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type DockItem = { href: string; label: string; active: boolean; icon: ComponentType<SVGProps<SVGSVGElement>> };

/** Bottom navigation dock. Links are real links; Left/Right/Home/End move focus along the dock. */
export function Dock({ items, label, className }: { items: DockItem[]; label: string; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    const links = Array.from(ref.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const next = { ArrowRight: rtl ? i - 1 : i + 1, ArrowLeft: rtl ? i + 1 : i - 1, Home: 0, End: links.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    links[(next + links.length) % links.length]?.focus();
  }
  return (
    <nav
      ref={ref}
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "glass fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-fit items-center gap-1 overflow-x-auto !rounded-full p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {items.map(({ href, label: text, active, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          title={text}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold",
            active ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
          )}
        >
          <Icon aria-hidden className="size-5" />
          <span className={active ? "max-md:sr-only" : "sr-only xl:not-sr-only"}>{text}</span>
        </Link>
      ))}
    </nav>
  );
}
