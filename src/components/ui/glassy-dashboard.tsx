"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { PillTopBar } from "./pill-top-bar";

gsap.registerPlugin(useGSAP);

/**
 * Glass workspace frame (adapted from the owner's reference, docs/design/reference/glassy-dashboard.tsx):
 * pill top bar, content area and a bottom dock (passed in as `nav`). It holds no data; the caller passes brand, actions, nav items
 * and page content. Elements marked `data-glass-enter` fade up once on load. GSAP is skipped entirely when
 * the visitor prefers reduced motion.
 */
export function GlassyShell({ brand, actions, nav, children }: { brand: ReactNode; actions: ReactNode; nav: ReactNode; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from("[data-glass-enter]", { opacity: 0, y: 14, duration: 0.5, ease: "power2.out", stagger: 0.06, clearProps: "opacity,transform" });
    },
    { scope: root },
  );
  return (
    <div ref={root} className="mx-auto max-w-6xl px-3 pb-28 pt-3 sm:px-6">
      <div data-glass-enter>
        <PillTopBar brand={brand}>{actions}</PillTopBar>
      </div>
      <main data-glass-enter className="py-6">
        {children}
      </main>
      {nav}
    </div>
  );
}
