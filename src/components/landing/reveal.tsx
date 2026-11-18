"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades and lifts children in when they scroll into view. Content is visible without JS
 * (server render is visible; hiding happens only after hydration) and with reduced motion.
 */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) return; // already on screen: never hide it
    setState("hidden");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transition: "opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1)",
        transitionDelay: `${delay}ms`,
        opacity: state === "hidden" ? 0 : 1,
        transform: state === "hidden" ? "translateY(18px)" : "none",
      }}
    >
      {children}
    </div>
  );
}
