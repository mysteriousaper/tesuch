"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("turnstile-load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Turnstile languages: no Armenian, so `hy` falls back to the visitor's browser language. */
const LANG: Record<string, string> = { ru: "ru", en: "en", hy: "auto" };

/** Explicit-render Turnstile widget. `resetSignal` change = fetch a fresh token (tokens are single-use). */
export function Turnstile({
  siteKey,
  locale,
  label,
  resetSignal,
  onToken,
  onError,
}: {
  siteKey: string;
  locale: string;
  label: string;
  resetSignal: number;
  onToken: (token: string | null) => void;
  onError: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const cb = useRef({ onToken, onError });
  cb.current = { onToken, onError };

  useEffect(() => {
    let dead = false;
    loadScript()
      .then(() => {
        if (dead || !box.current || !window.turnstile) return;
        id.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          language: LANG[locale] ?? "auto",
          theme: "auto",
          appearance: "always",
          callback: (t: string) => cb.current.onToken(t),
          "expired-callback": () => cb.current.onToken(null),
          "timeout-callback": () => cb.current.onToken(null),
          "error-callback": () => {
            cb.current.onToken(null);
            cb.current.onError();
          },
        });
      })
      .catch(() => {
        if (!dead) cb.current.onError();
      });
    return () => {
      dead = true;
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
  }, [siteKey, locale]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    cb.current.onToken(null);
    if (id.current && window.turnstile) window.turnstile.reset(id.current);
  }, [resetSignal]);

  return <div ref={box} role="group" aria-label={label} className="min-h-[65px]" />;
}
