import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_TABLES, ROLES } from "./lib";

const load = (locale: string, ns: string) => JSON.parse(readFileSync(join(process.cwd(), "messages", locale, `${ns}.json`), "utf8"));
const keys = (o: unknown, p = ""): string[] =>
  o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k)) : [p];

describe.each(["members", "audit"])("%s messages", (ns) => {
  const en = keys(load("en", ns)).sort();
  it.each(["hy", "ru"])("%s has exactly the English keys", (locale) => {
    expect(keys(load(locale, ns)).sort()).toEqual(en);
  });
});

describe("message coverage", () => {
  const en = load("en", "audit").audit;
  const m = load("en", "members").members;
  it("labels every audited table, action and role", () => {
    for (const t of AUDIT_TABLES) expect(en.tables[t]).toBeTruthy();
    for (const a of AUDIT_ACTIONS) expect(en.actions[a]).toBeTruthy();
    for (const r of ROLES) expect(m.roles[r]).toBeTruthy();
  });
});
