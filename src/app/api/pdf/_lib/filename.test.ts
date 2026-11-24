import { describe, expect, it } from "vitest";
import { nameSlug, pdfDisposition } from "./filename";

describe("pdf filenames", () => {
  it("slugs names in any script", () => {
    expect(nameSlug("Արամ  Պետրոսյան")).toBe("արամ-պետրոսյան");
    expect(nameSlug("Ivanov, Ivan (2)")).toBe("ivanov-ivan-2");
  });

  it("keeps the ASCII id filename and adds the name", () => {
    const d = pdfDisposition("probation-confirm", "12345678-aaaa", "2026-11-24", "Արամ Պետրոսյան");
    expect(d).toContain('filename="tesuch-probation-confirm-12345678-2026-11-24.pdf"');
    expect(decodeURIComponent(d.split("filename*=UTF-8''")[1])).toBe("tesuch-probation-confirm-արամ-պետրոսյան-2026-11-24.pdf");
  });

  it("falls back to the id alone without a usable name", () => {
    expect(pdfDisposition("dismissal", "abcdefgh-1", "2026-11-24", "  ")).toBe('attachment; filename="tesuch-dismissal-abcdefgh-2026-11-24.pdf"');
  });

  it("never lets header characters through", () => {
    const d = pdfDisposition("x", "id", "2026-11-24", 'a"\r\nb');
    expect(d).not.toMatch(/[\r\n]/);
    expect(d.split("filename*=UTF-8''")[1]).toBe("tesuch-x-a-b-2026-11-24.pdf");
  });
});
