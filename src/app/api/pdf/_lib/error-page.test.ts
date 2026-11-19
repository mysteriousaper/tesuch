import { describe, expect, it } from "vitest";
import { errorHtml, errorLocale, pdfError } from "./error-page";

const req = (url: string, headers: Record<string, string> = {}) => new Request(`http://x${url}`, { headers });

describe("pdfError", () => {
  it("returns localized HTML for browser navigations, with the right status", async () => {
    const r = pdfError(req("/api/pdf/probation?contract=x", { accept: "text/html,application/xhtml+xml", referer: "http://x/ru/app/documents" }), "notFound");
    expect(r.status).toBe(404);
    expect(r.headers.get("content-type")).toContain("text/html");
    const html = await r.text();
    expect(html).toContain('lang="ru"');
    expect(html).toContain("Документ не найден");
    expect(html).toContain('href="/ru/app/documents"');
  });
  it("keeps JSON for API callers", async () => {
    const r = pdfError(req("/api/pdf/checklist", { accept: "*/*" }), "invalid", "company");
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "invalid company" });
  });
  it("sends signed-out browsers to the login page", () => {
    expect(errorHtml("unauthorized", "en")).toContain('href="/en/login"');
  });
});

describe("errorLocale", () => {
  it("prefers ?locale=, then referer, then Accept-Language, else hy", () => {
    expect(errorLocale(req("/a?locale=en", { referer: "http://x/ru/app" }))).toBe("en");
    expect(errorLocale(req("/a", { referer: "http://x/ru/app" }))).toBe("ru");
    expect(errorLocale(req("/a", { "accept-language": "en-US,en;q=0.9" }))).toBe("en");
    expect(errorLocale(req("/a?locale=de", { referer: "not a url" }))).toBe("hy");
  });
});
