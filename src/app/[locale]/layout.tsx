import "@fontsource/noto-sans-armenian/400.css";
import "@fontsource/noto-sans-armenian/600.css";
import "@fontsource/noto-sans-armenian/700.css";
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "../globals.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DEFAULT_THEME, MODE_SCRIPT } from "@/components/theme/config";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const c = await getTranslations({ locale, namespace: "common" });
  return {
    title: { default: c("appName"), template: `%s · ${c("appName")}` },
    description: t("subtitle"),
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])) },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    // data-mode is set before paint by MODE_SCRIPT from the user's cookie (absent = follow the OS), so the
    // attribute can differ from the server HTML; that is expected, hence suppressHydrationWarning.
    // Not read via cookies() here on purpose: that would make every page dynamic and lose static rendering.
    <html lang={locale} data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
