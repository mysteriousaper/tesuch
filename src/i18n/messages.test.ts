// Localization guard: every messages/<locale>/*.json must have the same keys, the same ICU placeholders,
// no empty strings, compile as ICU messages, and Armenian text must not leak Latin words or ASCII punctuation.
// Owner: Localization dept. Glossary and style rules: docs/guide/GLOSSARY.md.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { routing } from "./routing";

const ROOT = join(__dirname, "..", "..", "messages");
const LOCALES = routing.locales;
const BASE = routing.defaultLocale;

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

function namespaces(locale: string): string[] {
  return readdirSync(join(ROOT, locale)).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
}

function load(locale: string, ns: string): Tree {
  return JSON.parse(readFileSync(join(ROOT, locale, `${ns}.json`), "utf8")) as Tree;
}

type Arg = { name: string; type: string };
type Parsed = { args: Arg[]; text: string };

/** Minimal ICU MessageFormat reader: collects arguments (with their type) and the literal text. */
function parseIcu(msg: string): Parsed {
  const args: Arg[] = [];
  let text = "";
  let i = 0;
  const readMessage = (inBranch: boolean): void => {
    while (i < msg.length) {
      const c = msg[i];
      if (c === "}" && inBranch) return;
      if (c === "{") {
        i++;
        readArgument();
        continue;
      }
      if (c === "'" && (msg[i + 1] === "{" || msg[i + 1] === "}" || msg[i + 1] === "'")) {
        // ICU quoting: '{' etc. — treat the quoted char as literal text
        text += msg[i + 1];
        i += msg[i + 1] === "'" ? 2 : 3;
        continue;
      }
      if (!(inBranch && c === "#")) text += c;
      i++;
    }
    if (inBranch) throw new Error(`Unclosed branch in: ${msg}`);
  };
  const readArgument = (): void => {
    const start = i;
    while (i < msg.length && msg[i] !== "," && msg[i] !== "}") i++;
    const name = msg.slice(start, i).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Bad argument name "${name}" in: ${msg}`);
    if (msg[i] === "}") {
      i++;
      args.push({ name, type: "simple" });
      return;
    }
    i++; // ,
    const tStart = i;
    while (i < msg.length && msg[i] !== "," && msg[i] !== "}") i++;
    const type = msg.slice(tStart, i).trim();
    args.push({ name, type });
    if (msg[i] === "}") {
      i++;
      return;
    }
    i++; // ,
    if (type === "plural" || type === "select" || type === "selectordinal") {
      while (i < msg.length) {
        while (i < msg.length && /\s/.test(msg[i])) i++;
        if (msg[i] === "}") {
          i++;
          return;
        }
        while (i < msg.length && msg[i] !== "{" && !/\s/.test(msg[i])) i++;
        while (i < msg.length && /\s/.test(msg[i])) i++;
        if (msg[i] !== "{") throw new Error(`Expected branch in: ${msg}`);
        i++;
        readMessage(true);
        i++; // closing }
      }
      throw new Error(`Unclosed ${type} in: ${msg}`);
    }
    // number/date/time style: skip to the closing brace
    while (i < msg.length && msg[i] !== "}") i++;
    i++;
  };
  readMessage(false);
  return { args, text };
}

const PLURALISH = new Set(["plural", "selectordinal"]);
/** Placeholder names, ignoring how a locale chooses to inflect them (plural in ru, plain in hy is fine). */
const placeholderNames = (msg: string) => [...new Set(parseIcu(msg).args.map((a) => a.name))].sort();

// Latin words allowed inside Armenian strings: product, file and brand names, domains.
const HY_LATIN_ALLOWED = new Set(["Telegram", "Excel", "CSV", "PDF", "Tesuch", "ArmSoft", "Supabase", "csv", "xlsx", "email", "arlis", "am", "ID"]);

function hyProblems(value: string): string[] {
  const { text } = parseIcu(value);
  const cleaned = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[\w.-]+\.(am|com|org|ai)\b/g, " ")
    .replace(/\.(csv|xlsx)\b/g, " ")
    .replace(/\d+\.\d+\.\d+/g, " "); // dates such as 15.01.2026
  const problems: string[] = [];
  for (const w of cleaned.match(/[A-Za-z]+/g) ?? []) if (!HY_LATIN_ALLOWED.has(w)) problems.push(`Latin word "${w}"`);
  // Armenian punctuation: ։ (full stop), ՝ (pause), ՞ (question), ՛ (emphasis), ․ (abbreviation), « » quotes.
  if (/[.?!;]/.test(cleaned.replace(/\.\.\./g, ""))) problems.push("ASCII . ? ! ; (use ։ ՞ ՛ ․)");
  if (/:/.test(cleaned)) problems.push("ASCII colon (use ՝ or ։)");
  if (/["“”„]/.test(cleaned)) problems.push("Latin quotes (use « »)");
  return problems;
}

const sample = (arg: Arg) => (PLURALISH.has(arg.type) || arg.type === "number" ? 3 : arg.type === "date" ? new Date(0) : "x");

describe("messages", () => {
  const baseNamespaces = namespaces(BASE);

  it("every locale has the same namespace files", () => {
    for (const l of LOCALES) expect(namespaces(l), l).toEqual(baseNamespaces);
  });

  for (const ns of baseNamespaces) {
    describe(ns, () => {
      const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(load(l, ns))])) as Record<string, Record<string, string>>;
      const keys = Object.keys(flat[BASE]).sort();

      it("has identical key sets in every locale", () => {
        for (const l of LOCALES) expect(Object.keys(flat[l]).sort(), `${l}/${ns}.json`).toEqual(keys);
      });

      it("has no empty strings", () => {
        for (const l of LOCALES) for (const [k, v] of Object.entries(flat[l])) expect(v.trim(), `${l}/${ns}: ${k}`).not.toBe("");
      });

      it("uses identical ICU placeholders per key", () => {
        for (const k of keys) {
          const want = placeholderNames(flat[BASE][k]);
          for (const l of LOCALES) if (flat[l][k] !== undefined) expect(placeholderNames(flat[l][k]), `${l}/${ns}: ${k}`).toEqual(want);
        }
      });

      it("compiles and formats in every locale", () => {
        for (const l of LOCALES) {
          const errors: string[] = [];
          const t = createTranslator({ locale: l, messages: load(l, ns), onError: (e) => errors.push(e.message) }) as unknown as (key: string, values?: Record<string, unknown>) => string;
          for (const k of keys) {
            if (flat[l][k] === undefined) continue; // reported by the key-set test
            const values = Object.fromEntries(parseIcu(flat[l][k]).args.map((a) => [a.name, sample(a)]));
            const before = errors.length;
            const out = t(k, values);
            if (errors.length > before) errors[errors.length - 1] = `${l}/${ns}: ${k}: ${errors.at(-1)}`;
            else expect(out, `${l}/${ns}: ${k}`).not.toMatch(/[{}]/);
          }
          expect(errors).toEqual([]);
        }
      });

      it("Armenian strings use Armenian script and punctuation", () => {
        const bad = Object.entries(flat.hy).flatMap(([k, v]) => hyProblems(v).map((p) => `${k}: ${p} — ${v}`));
        expect(bad).toEqual([]);
      });
    });
  }
});

describe("parseIcu", () => {
  it("reads plural branches and placeholders", () => {
    const p = parseIcu("{count, plural, =0 {Խնդիր չկա} one {# բաց խնդիր} other {# բաց խնդիր}} · {name}");
    expect(p.args.map((a) => a.name)).toEqual(["count", "name"]);
    expect(p.text).toContain("Խնդիր չկա");
    expect(p.text).not.toContain("plural");
  });
  it("flags Latin and ASCII punctuation in Armenian", () => {
    expect(hyProblems("Ուղարկել Telegram-ով։")).toEqual([]);
    expect(hyProblems("Send now.")).not.toEqual([]);
    expect(hyProblems("Էլ. հասցե")).not.toEqual([]);
  });
});
