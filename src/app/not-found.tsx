import "./globals.css";

// Root 404 for requests that never reach a locale (the middleware redirects almost everything to /hy/...).
// There is no root layout, so this page renders its own <html>. Static text in all three languages.
const TEXT = [
  { lang: "hy", title: "Էջը չի գտնվել", home: "Գլխավոր էջ", href: "/hy" },
  { lang: "ru", title: "Страница не найдена", home: "На главную", href: "/ru" },
  { lang: "en", title: "Page not found", home: "Home page", href: "/en" },
] as const;

export default function RootNotFound() {
  return (
    <html lang="hy" data-theme="official">
      <body className="min-h-dvh bg-bg text-ink antialiased">
        <title>404 · Տեսուչ</title>
        <meta name="robots" content="noindex" />
        <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
          <p className="text-sm font-semibold text-muted">404</p>
          {TEXT.map((x, i) => (
            <section key={x.lang} lang={x.lang} className="flex flex-col gap-2">
              {i === 0 ? <h1 className="text-2xl font-bold">{x.title}</h1> : <h2 className="text-xl font-bold">{x.title}</h2>}
              <a href={x.href} className="text-accent underline underline-offset-4">{x.home}</a>
            </section>
          ))}
        </main>
      </body>
    </html>
  );
}
