import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LOCALES = ["hy", "ru", "en"] as const;
const load = (locale: string, ns: string) => JSON.parse(readFileSync(join(process.cwd(), "messages", locale, `${ns}.json`), "utf8"));

/** Every key path, with array items and section ids, so all locales have the same structure. */
function shape(v: unknown, path = ""): string[] {
  if (Array.isArray(v)) return [`${path}[${v.length}]`, ...v.flatMap((x, i) => shape(x, `${path}[${(x as { id?: string })?.id ?? i}]`))];
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => shape(x, path ? `${path}.${k}` : k));
  return [path];
}

function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

describe.each(["legal", "privacy"])("messages/%s.json", (ns) => {
  it("has the same structure in hy, ru and en", () => {
    const en = shape(load("en", ns));
    for (const l of LOCALES) expect(shape(load(l, ns))).toEqual(en);
  });

  it("never cites article numbers (they are for the lawyer to add)", () => {
    for (const l of LOCALES) {
      for (const s of strings(load(l, ns))) expect(s).not.toMatch(/(article|статья|статьи|հոդված)\s*\d/i);
    }
  });

  it("Armenian uses Armenian punctuation, not a Latin colon or question mark at sentence end", () => {
    for (const s of strings(load("hy", ns))) {
      if (!/[Ա-և]/.test(s)) continue;
      expect(s, s).not.toMatch(/[Ա-և»][.?]\s*$/);
    }
  });
});
