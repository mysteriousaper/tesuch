// CSV byte decoding. Excel in Russian/Armenian locales often saves CSV as windows-1251, not UTF-8.
export type CsvEncoding = "utf-8" | "windows-1251";

export interface DecodedCsv {
  text: string;
  encoding: CsvEncoding;
  /** True when UTF-8 was strictly tried and failed, so windows-1251 was chosen automatically. */
  fellBack: boolean;
}

/** Strict UTF-8 decode; returns null on invalid bytes. A leading BOM is stripped. */
function strictUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Decode CSV bytes. With `forced` the chosen encoding is used as is (UTF-8 then decodes leniently,
 * invalid bytes become U+FFFD); otherwise UTF-8 is tried strictly, falling back to windows-1251.
 */
export function decodeCsv(buffer: ArrayBuffer | Uint8Array, forced?: CsvEncoding): DecodedCsv {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (forced === "windows-1251") return { text: new TextDecoder("windows-1251").decode(bytes), encoding: "windows-1251", fellBack: false };
  if (forced === "utf-8") return { text: new TextDecoder("utf-8").decode(bytes), encoding: "utf-8", fellBack: false };
  const utf8 = strictUtf8(bytes);
  if (utf8 !== null) return { text: utf8, encoding: "utf-8", fellBack: false };
  return { text: new TextDecoder("windows-1251").decode(bytes), encoding: "windows-1251", fellBack: true };
}
