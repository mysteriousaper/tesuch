// handleUpdate against an in-memory fake of the few supabase-js query shapes it uses.
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UNLINKED_HELP } from "./commands";

vi.mock("server-only", () => ({}));
const { handleUpdate } = await import("./telegram-bot");

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/** Records every query so tests can assert on scoping, and applies eq/in filters to in-memory rows. */
function fakeDb(tables: Tables, opts: { failOn?: string } = {}) {
  const log: { table: string; op: string; filters: [string, string, unknown][] }[] = [];
  const db = {
    from(table: string) {
      const filters: [string, string, unknown][] = [];
      let op = "select";
      let payload: Row | null = null;
      const entry = { table, op, filters };
      log.push(entry);
      const rows = () =>
        (tables[table] ?? []).filter((r) =>
          filters.every(([kind, col, v]) => (kind === "eq" ? r[col] === v : (v as unknown[]).includes(r[col]))),
        );
      const run = () => {
        entry.op = op;
        if (opts.failOn === table) return { data: null, error: { message: "boom" } };
        if (op === "delete") {
          const gone = new Set(rows());
          tables[table] = (tables[table] ?? []).filter((r) => !gone.has(r));
          return { data: null, error: null };
        }
        if (op === "upsert") {
          (tables[table] ??= []).push(payload!);
          return { data: null, error: null };
        }
        // Emulate the employees(full_name) embed on findings.
        const data = rows().map((r) =>
          table === "findings" ? { ...r, employees: (tables.employees ?? []).find((e) => e.id === r.employee_id) ?? null } : r,
        );
        return { data, error: null };
      };
      const q = {
        select: () => q,
        delete: () => ((op = "delete"), q),
        upsert: (p: Row) => ((op = "upsert"), (payload = p), Promise.resolve(run())),
        eq: (col: string, v: unknown) => (filters.push(["eq", col, v]), q),
        in: (col: string, v: unknown[]) => (filters.push(["in", col, v]), q),
        limit: () => q,
        maybeSingle: () => {
          const r = run();
          return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error });
        },
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
      };
      return q;
    },
  };
  return { db: db as unknown as SupabaseClient, log, tables };
}

const CHAT_A = 1001;
const CHAT_B = 2002;
const upd = (text: string, o: { chatId?: number; type?: string; lang?: string; isBot?: boolean } = {}) => ({
  message: { chat: { id: o.chatId ?? CHAT_A, type: o.type ?? "private" }, from: { language_code: o.lang ?? "en", is_bot: o.isBot ?? false }, text },
});

let tables: Tables;
beforeEach(() => {
  tables = {
    telegram_links: [{ user_id: "userA", chat_id: CHAT_A }, { user_id: "userB", chat_id: CHAT_B }],
    telegram_link_tokens: [],
    memberships: [{ user_id: "userA", org_id: "orgA", role: "viewer" }, { user_id: "userB", org_id: "orgB", role: "owner" }],
    orgs: [{ id: "orgA", name: "Alpha Firm", kind: "accounting_firm" }, { id: "orgB", name: "Bravo Secret Org", kind: "company" }],
    companies: [{ id: "cA", org_id: "orgA", name: "Alpha Co" }, { id: "cB", org_id: "orgB", name: "Bravo Secret Co" }],
    employees: [{ id: "eA", full_name: "Anna" }, { id: "eB", full_name: "Bravo Secret Person" }],
    findings: [
      { org_id: "orgA", company_id: "cA", employee_id: "eA", rule_id: "probation-max", due_date: "2020-01-01", status: "open" },
      { org_id: "orgA", company_id: "cA", employee_id: "eA", rule_id: "probation-max", due_date: "2020-01-02", status: "fixed" },
      { org_id: "orgB", company_id: "cB", employee_id: "eB", rule_id: "probation-max", due_date: "2020-01-01", status: "open" },
    ],
  };
});

describe("handleUpdate: ignored updates", () => {
  it.each([
    ["group chat", upd("/status", { type: "group" })],
    ["supergroup", upd("/status", { type: "supergroup" })],
    ["channel", upd("/status", { type: "channel" })],
    ["bot sender", upd("/status", { isBot: true })],
    ["no text", { message: { chat: { id: CHAT_A, type: "private" } } }],
    ["no message", {}],
    ["non-numeric chat id", { message: { chat: { id: "1001", type: "private" }, text: "/status" } }],
  ])("%s → no reply, no DB access", async (_, u) => {
    const { db, log } = fakeDb(tables);
    expect(await handleUpdate(db, u as never)).toBeNull();
    expect(log).toHaveLength(0);
  });
});

describe("handleUpdate: unlinked chats", () => {
  it.each(["/status", "/issues", "/stop", "/help", "hello", "/start"])("%s → trilingual connect help", async (text) => {
    const { db } = fakeDb(tables);
    expect(await handleUpdate(db, upd(text, { chatId: 999 }))).toEqual({ chatId: 999, text: UNLINKED_HELP });
  });
  it("/stop from an unlinked chat deletes nothing", async () => {
    const { db } = fakeDb(tables);
    await handleUpdate(db, upd("/stop", { chatId: 999 }));
    expect(tables.telegram_links).toHaveLength(2);
  });
});

describe("handleUpdate: /status and /issues are scoped to the linked user's memberships", () => {
  it("/status shows only orgs the chat's user belongs to", async () => {
    const { db, log } = fakeDb(tables);
    const r = await handleUpdate(db, upd("/status"));
    expect(r?.chatId).toBe(CHAT_A);
    expect(r?.text).toContain("Alpha Firm");
    expect(r?.text).toContain("Alpha Co");
    expect(r?.text).toContain("Open findings: 1");
    expect(r?.text).not.toContain("Bravo");
    // Every tenant query was filtered by orgA only.
    for (const t of ["orgs", "companies", "findings"]) {
      const q = log.find((l) => l.table === t)!;
      expect(q.filters.some(([k, , v]) => k === "in" && JSON.stringify(v) === JSON.stringify(["orgA"]))).toBe(true);
    }
    expect(log.find((l) => l.table === "memberships")!.filters).toContainEqual(["eq", "user_id", "userA"]);
  });

  it("the other chat sees the other tenant only", async () => {
    const { db } = fakeDb(tables);
    const r = await handleUpdate(db, upd("/issues", { chatId: CHAT_B }));
    expect(r?.text).toContain("Bravo Secret Co · Bravo Secret Person");
    expect(r?.text).not.toContain("Alpha");
    expect(r?.text).not.toContain("Anna");
  });

  it("/issues 1 lists the company's open findings with an overdue marker, in Russian", async () => {
    const { db } = fakeDb(tables);
    const r = await handleUpdate(db, upd("/issues 1", { lang: "ru-RU" }));
    expect(r?.text).toContain("Alpha Co");
    expect(r?.text).toContain("Anna");
    expect(r?.text).toContain("01.01.2020 · ⏰ просрочено");
    expect(r?.text).not.toContain("02.01.2020"); // fixed finding
    expect(r?.text).toContain("Это не юридическая консультация");
  });

  it("company numbers cannot reach another tenant's company", async () => {
    const { db } = fakeDb(tables);
    const r = await handleUpdate(db, upd("/issues 2"));
    expect(r?.text).toBe("Company #2 not found. Send /status to see the numbers.");
  });

  it("a user with no memberships sees nothing", async () => {
    tables.memberships = tables.memberships.filter((m) => m.user_id !== "userA");
    const { db } = fakeDb(tables);
    expect((await handleUpdate(db, upd("/status", { lang: "hy" })))?.text).toBe("Դուք դեռ որևէ կազմակերպության անդամ չեք։");
  });

  it("bad /issues argument → usage", async () => {
    const { db } = fakeDb(tables);
    expect((await handleUpdate(db, upd("/issues x")))?.text).toContain("Usage: /issues");
  });

  it("DB errors become a polite error reply, never a stack trace", async () => {
    const { db } = fakeDb(tables, { failOn: "findings" });
    expect((await handleUpdate(db, upd("/status")))?.text).toBe("⚠️ Couldn&#39;t load your data. Please try again later.");
  });
});

describe("handleUpdate: /help and /stop", () => {
  it("/help and unknown text → localized command list", async () => {
    const { db } = fakeDb(tables);
    expect((await handleUpdate(db, upd("/help", { lang: "hy" })))?.text).toContain("Տեսուչ բոտի հրամաններ");
    expect((await handleUpdate(db, upd("what?")))?.text).toContain("/status");
  });

  it("/stop deletes only this chat's link", async () => {
    const { db } = fakeDb(tables);
    const r = await handleUpdate(db, upd("/stop"));
    expect(r?.text).toContain("disconnected");
    expect(tables.telegram_links).toEqual([{ user_id: "userB", chat_id: CHAT_B }]);
    // Afterwards the chat is unlinked.
    expect((await handleUpdate(db, upd("/status")))?.text).toBe(UNLINKED_HELP);
  });
});

describe("handleUpdate: /start linking", () => {
  const TOKEN = "t".repeat(32);
  it("valid token links the chat (moving it from any previous user) and is single-use", async () => {
    tables.telegram_link_tokens = [{ token: TOKEN, user_id: "userB", expires_at: new Date(Date.now() + 60_000).toISOString() }];
    const { db } = fakeDb(tables);
    const r = await handleUpdate(db, upd(`/start ${TOKEN}`, { lang: "ru" }));
    expect(r?.text).toContain("Тесуч подключён");
    expect(r?.text).toContain("/status");
    expect(tables.telegram_link_tokens).toHaveLength(0);
    expect(tables.telegram_links.filter((l) => l.chat_id === CHAT_A).map((l) => l.user_id)).toEqual(["userB"]);
    const again = await handleUpdate(db, upd(`/start ${TOKEN}`, { chatId: 3003 }));
    expect(again?.text).toContain("invalid or expired");
  });

  it("expired token is rejected and consumed", async () => {
    tables.telegram_link_tokens = [{ token: TOKEN, user_id: "userB", expires_at: new Date(Date.now() - 1000).toISOString() }];
    const { db } = fakeDb(tables);
    expect((await handleUpdate(db, upd(`/start ${TOKEN}`)))?.text).toContain("invalid or expired");
    expect(tables.telegram_link_tokens).toHaveLength(0);
    expect(tables.telegram_links.find((l) => l.chat_id === CHAT_A)?.user_id).toBe("userA");
  });
});
