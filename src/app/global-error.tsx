"use client";

import { useEffect } from "react";
import "./globals.css";

// Last-resort fallback when the locale layout itself fails: no translations are available here, so the text
// is static in all three languages. Never shows error.message or a stack; only the opaque digest.
const TEXT = [
  { lang: "hy", title: "Ինչ-որ բան այնպես չգնաց", body: "Չհաջողվեց բեռնել էջը։ Մի քանի վայրկյանից նորից փորձեք։", retry: "Նորից փորձել", home: "Գլխավոր էջ", href: "/hy" },
  { lang: "ru", title: "Что-то пошло не так", body: "Не удалось загрузить страницу. Попробуйте ещё раз через несколько секунд.", retry: "Повторить", home: "На главную", href: "/ru" },
  { lang: "en", title: "Something went wrong", body: "We couldn't load this page. Please try again in a few seconds.", retry: "Try again", home: "Home page", href: "/en" },
] as const;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(`[tesuch] global error${error.digest ? ` digest=${error.digest}` : ""}`);
  }, [error.digest]);

  return (
    <html lang="hy" data-theme="official">
      <body className="min-h-dvh bg-bg text-ink antialiased">
        <main role="alert" className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-16">
          {TEXT.map((x, i) => (
            <section key={x.lang} lang={x.lang} className="flex flex-col gap-3">
              {i === 0 ? <h1 className="text-2xl font-bold">{x.title}</h1> : <h2 className="text-xl font-bold">{x.title}</h2>}
              <p className="text-muted">{x.body}</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => reset()} className="rounded-theme bg-accent px-4 py-2.5 font-semibold text-accent-ink">{x.retry}</button>
                {/* Plain <a>: a full reload is the point when the app shell is broken. */}
                <a href={x.href} className="rounded-theme border border-control bg-surface px-4 py-2.5 font-semibold">{x.home}</a>
              </div>
            </section>
          ))}
          {error.digest && <p className="text-sm text-muted">digest: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
