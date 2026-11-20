import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// WCAG 1.4.11: the border of a form control / outlined button (--control) needs >= 3:1 against the
// surface it sits on. Parses the real tokens out of globals.css so drift fails the build.

const css = readFileSync("src/app/globals.css", "utf8");
const section = css.slice(css.indexOf("/* ===== Theme tokens"), css.indexOf("/* ===== End theme tokens"));
const [main, fallback] = section.split("@supports not (color: light-dark(white, black))");

function declarations(cssText: string, theme: string): Record<string, string> {
  const body = new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(cssText)?.[1];
  if (!body) throw new Error(`no rule for ${theme}`);
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

/** Resolve `light-dark(a, b)` or a plain hex to the colour for one mode. */
function pick(value: string, mode: "light" | "dark"): string {
  const m = /^light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)$/i.exec(value);
  if (m) return mode === "light" ? m[1] : m[2];
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  throw new Error(`unsupported colour ${value}`);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES = ["official", "fintech", "warm"];

describe("contrast helper", () => {
  it("matches known WCAG values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
  });
});

describe("--control (1.4.11 non-text contrast)", () => {
  for (const theme of THEMES) {
    for (const mode of ["light", "dark"] as const) {
      const tokens = declarations(main, theme);
      for (const bg of ["surface", "bg"]) {
        it(`${theme}/${mode}: control vs ${bg} >= 3:1`, () => {
          expect(contrast(pick(tokens.control, mode), pick(tokens[bg], mode))).toBeGreaterThanOrEqual(3);
        });
      }
    }
    it(`${theme}: light fallback control vs surface/bg >= 3:1`, () => {
      const t = declarations(fallback, theme);
      expect(contrast(pick(t.control, "light"), pick(t.surface, "light"))).toBeGreaterThanOrEqual(3);
      expect(contrast(pick(t.control, "light"), pick(t.bg, "light"))).toBeGreaterThanOrEqual(3);
    });
  }
});
