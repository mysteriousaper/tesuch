import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, MODE_COOKIE, MODE_SCRIPT, parseMode, THEMES } from "./config";

// Guards the hand-kept copy in globals.css against design/tokens.json, the single source of truth.

type Tokens = {
  default: string;
  themes: Record<string, { color: Record<string, { light: string; dark: string }>; radius: string; "radius-lg": string; "heading-tracking": string }>;
};

const tokens = JSON.parse(readFileSync("design/tokens.json", "utf8")) as Tokens;
const css = readFileSync("src/app/globals.css", "utf8");
const section = css.slice(css.indexOf("/* ===== Theme tokens"), css.indexOf("/* ===== End theme tokens"));
const [main, fallback] = section.split("@supports not (color: light-dark(white, black))");

/** Declarations of the first rule whose selector list contains [data-theme="name"]. */
function declarations(cssText: string, name: string): Record<string, string> {
  const re = new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([^}]*)\\}`);
  const body = re.exec(cssText)?.[1];
  if (!body) throw new Error(`no rule for [data-theme="${name}"]`);
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

describe("design tokens", () => {
  it("tokens.json and config agree on themes and default", () => {
    expect(Object.keys(tokens.themes)).toEqual([...THEMES]);
    expect(tokens.default).toBe(DEFAULT_THEME);
    expect(main).toMatch(new RegExp(`:root,\\s*\\[data-theme="${DEFAULT_THEME}"\\]`));
  });

  for (const name of THEMES) {
    it(`globals.css matches tokens.json for ${name}`, () => {
      const t = tokens.themes[name];
      const expected: Record<string, string> = {
        ...Object.fromEntries(Object.entries(t.color).map(([k, v]) => [k, `light-dark(${v.light}, ${v.dark})`])),
        radius: t.radius,
        "radius-lg": t["radius-lg"],
        "heading-tracking": t["heading-tracking"],
      };
      expect(declarations(main, name)).toEqual(expected);
    });

    it(`no-light-dark() fallback for ${name} uses the light palette`, () => {
      expect(declarations(fallback, name)).toEqual(Object.fromEntries(Object.entries(tokens.themes[name].color).map(([k, v]) => [k, v.light])));
    });
  }

  it("every colour is a 6-digit hex in both modes, and all themes share the same keys", () => {
    const keys = Object.keys(tokens.themes[DEFAULT_THEME].color);
    for (const t of Object.values(tokens.themes)) {
      expect(Object.keys(t.color)).toEqual(keys);
      for (const v of Object.values(t.color)) {
        expect(v.light).toMatch(/^#[0-9a-f]{6}$/);
        expect(v.dark).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("every token is exposed to Tailwind via @theme inline", () => {
    for (const k of Object.keys(tokens.themes[DEFAULT_THEME].color)) expect(css).toContain(`--color-${k}: var(--${k});`);
  });
});

describe("mode", () => {
  it("parses only light/dark, everything else is system", () => {
    expect([parseMode("light"), parseMode("dark"), parseMode("auto"), parseMode(undefined), parseMode("dark<script>")]).toEqual(["light", "dark", "system", "system", "system"]);
  });
  it("pre-paint script applies only a whitelisted cookie value", () => {
    const set = (cookie: string) => {
      const attrs: Record<string, string> = {};
      const document = { cookie, documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
      new Function("document", MODE_SCRIPT)(document);
      return attrs["data-mode"];
    };
    expect(set(`a=1; ${MODE_COOKIE}=dark`)).toBe("dark");
    expect(set(`${MODE_COOKIE}=light; b=2`)).toBe("light");
    expect(set(`${MODE_COOKIE}=evil`)).toBeUndefined();
    expect(set(`x${MODE_COOKIE}=dark`)).toBeUndefined();
    expect(set("")).toBeUndefined();
  });
});
