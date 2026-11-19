// Errors for the PDF routes. Browser navigations (download links, the dismissal form) get a small
// localized HTML page instead of raw JSON; fetch/API callers keep JSON. Static text only, no user input.

type Loc = "hy" | "ru" | "en";
export type PdfErrorKind = "invalid" | "unauthorized" | "notFound";

const STATUS: Record<PdfErrorKind, number> = { invalid: 400, unauthorized: 401, notFound: 404 };

const TEXT: Record<Loc, { title: string; back: string; signIn: string } & Record<PdfErrorKind, string>> = {
  hy: {
    title: "Փաստաթուղթը հնարավոր չէ ստեղծել",
    invalid: "Հղումը սխալ է կամ թերի։ Վերադարձեք «Փաստաթղթեր» էջ և փորձեք կրկին։",
    unauthorized: "Մուտք գործեք՝ փաստաթուղթը ներբեռնելու համար։",
    notFound: "Փաստաթուղթը չի գտնվել, կամ դուք դրա հասանելիությունը չունեք։",
    back: "← Վերադառնալ փաստաթղթերին",
    signIn: "Մուտք",
  },
  ru: {
    title: "Не удалось создать документ",
    invalid: "Ссылка неверная или неполная. Вернитесь на страницу «Документы» и попробуйте снова.",
    unauthorized: "Войдите, чтобы скачать документ.",
    notFound: "Документ не найден или у вас нет к нему доступа.",
    back: "← Вернуться к документам",
    signIn: "Войти",
  },
  en: {
    title: "Could not create the document",
    invalid: "The link is wrong or incomplete. Go back to Documents and try again.",
    unauthorized: "Sign in to download this document.",
    notFound: "Document not found, or you don't have access to it.",
    back: "← Back to documents",
    signIn: "Sign in",
  },
};

const isLoc = (s: string | null | undefined): s is Loc => s === "hy" || s === "ru" || s === "en";

/** ?locale= first, then the page the user came from (/ru/app/...), then Accept-Language, else Armenian. */
export function errorLocale(req: Request): Loc {
  const url = new URL(req.url);
  const q = url.searchParams.get("locale");
  if (isLoc(q)) return q;
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      const seg = new URL(ref).pathname.split("/")[1];
      if (isLoc(seg)) return seg;
    } catch {
      /* ignore malformed referer */
    }
  }
  const lang = (req.headers.get("accept-language") ?? "").slice(0, 2).toLowerCase();
  return isLoc(lang) ? lang : "hy";
}

/** True for top-level browser navigations, which send Accept: text/html. */
export const wantsHtml = (req: Request) => (req.headers.get("accept") ?? "").includes("text/html");

export function errorHtml(kind: PdfErrorKind, locale: Loc): string {
  const t = TEXT[locale];
  const action =
    kind === "unauthorized"
      ? `<a href="/${locale}/login">${t.signIn}</a>`
      : `<a href="/${locale}/app/documents">${t.back}</a>`;
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t.title} · Tesuch</title>
<style>
:root{color-scheme:light dark;--bg:#f6f4ef;--card:#fff;--ink:#14213d;--muted:#535c6e;--line:#dad5c8;--accent:#1f3a68}
@media (prefers-color-scheme:dark){:root{--bg:#0e1626;--card:#152036;--ink:#e8ecf4;--muted:#a3aec2;--line:#2a3854;--accent:#8fb0e8}}
body{margin:0;min-height:100dvh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font-family:"Noto Sans Armenian","Noto Sans",system-ui,sans-serif;padding:16px}
main{max-width:28rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:24px}
h1{font-size:1.25rem;margin:0 0 8px}p{color:var(--muted);margin:0 0 16px;line-height:1.5}a{color:var(--accent);font-weight:600}
</style></head>
<body><main><h1>${t.title}</h1><p>${t[kind]}</p>${action}</main></body></html>`;
}

export function pdfError(req: Request, kind: PdfErrorKind, detail?: string): Response {
  const status = STATUS[kind];
  if (wantsHtml(req)) {
    return new Response(errorHtml(kind, errorLocale(req)), {
      status,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  }
  const error = kind === "invalid" ? `invalid ${detail ?? "request"}` : kind === "unauthorized" ? "unauthorized" : "not found";
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}
