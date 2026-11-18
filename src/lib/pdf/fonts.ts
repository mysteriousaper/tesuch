// Registers Noto Sans (OFL-1.1) for react-pdf. Armenian glyphs come from Noto Sans Armenian;
// Latin and Cyrillic from Noto Sans. react-pdf falls back through the family list per glyph.
import path from "node:path";
import { Font } from "@react-pdf/renderer";

export const FONT_STACK = ["NotoArmenian", "NotoLatin", "NotoCyrillic"];

const FILES: Record<string, string> = {
  NotoArmenian: "noto-sans-armenian-armenian",
  NotoLatin: "noto-sans-latin",
  NotoCyrillic: "noto-sans-cyrillic",
};

let registered = false;

/**
 * Idempotent. Fonts are read from public/fonts. On Vercel, add public/fonts/** to
 * outputFileTracingIncludes for the PDF route so the files ship with the function.
 */
export function registerFonts(dir = path.join(process.cwd(), "public", "fonts")): void {
  if (registered) return;
  for (const [family, base] of Object.entries(FILES)) {
    Font.register({
      family,
      fonts: [
        { src: path.join(dir, `${base}-400-normal.woff`), fontWeight: 400 },
        { src: path.join(dir, `${base}-700-normal.woff`), fontWeight: 700 },
      ],
    });
  }
  // Armenian words must not be split by react-pdf's English hyphenation.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
