import { describe, expect, it } from "vitest";
import {
  buildAccount, detectLocale, fit, helpReply, issuesReply, ISSUES_LIMIT, linkedReply, parseCommand, sortIssues, statusReply,
  type CompanyRow, type FindingRow, type Issue, type OrgRow,
} from "./commands";
import { DISCLAIMER, escapeHtml, LOCALES, ruleById, T } from "./i18n";
import { TELEGRAM_MAX } from "./messages";

const ASOF = "2026-11-19";
const orgA: OrgRow = { id: "orgA", name: "Firm A", kind: "accounting_firm" };
const orgB: OrgRow = { id: "orgB", name: "Beta LLC", kind: "company" };
const co = (id: string, org_id: string, name: string): CompanyRow => ({ id, org_id, name });
const fd = (company_id: string, org_id: string, due_date: string, o: Partial<FindingRow> = {}): FindingRow => ({
  org_id, company_id, rule_id: "probation-max", due_date, employee_name: "Anna", ...o,
});

/** Rough well-formedness: every <b>/<i> opened is closed, no raw tags other than ours. */
function balanced(html: string): boolean {
  for (const t of ["b", "i"]) {
    if ((html.match(new RegExp(`<${t}>`, "g")) ?? []).length !== (html.match(new RegExp(`</${t}>`, "g")) ?? []).length) return false;
  }
  return !/<(?!\/?(b|i)>)/.test(html);
}

describe("detectLocale", () => {
  it.each([
    ["hy", "hy"], ["hy-AM", "hy"], ["ru", "ru"], ["RU-ru", "ru"], ["en", "en"], ["en-US", "en"], ["uk", "en"], ["", "en"],
    [undefined, "en"], [null, "en"],
  ])("%s → %s", (code, want) => expect(detectLocale(code as string | undefined)).toBe(want));
});

describe("parseCommand", () => {
  it("parses commands, case-insensitive, with or without our bot suffix", () => {
    expect(parseCommand("/status")).toEqual({ cmd: "status" });
    expect(parseCommand("  /STATUS  ")).toEqual({ cmd: "status" });
    expect(parseCommand("/status@Tesuch1234_bot")).toEqual({ cmd: "status" });
    expect(parseCommand("/status@tesuch1234_BOT")).toEqual({ cmd: "status" });
    expect(parseCommand("/help")).toEqual({ cmd: "help" });
    expect(parseCommand("/stop")).toEqual({ cmd: "stop" });
  });
  it("treats commands addressed to other bots, garbage and overlong input as unknown", () => {
    expect(parseCommand("/status@OtherBot")).toEqual({ cmd: "unknown" });
    expect(parseCommand("/frobnicate")).toEqual({ cmd: "unknown" });
    expect(parseCommand("/")).toEqual({ cmd: "unknown" });
    expect(parseCommand(`/status ${"x".repeat(600)}`)).toEqual({ cmd: "unknown" });
  });
  it("plain text is not a command", () => {
    expect(parseCommand("hello")).toEqual({ cmd: "text" });
    expect(parseCommand("")).toEqual({ cmd: "text" });
    expect(parseCommand(undefined)).toEqual({ cmd: "text" });
  });
  it("parses /start tokens strictly", () => {
    const tok = "a".repeat(32);
    expect(parseCommand(`/start ${tok}`)).toEqual({ cmd: "start", token: tok });
    expect(parseCommand(`/start@Tesuch1234_bot ${tok}`)).toEqual({ cmd: "start", token: tok });
    expect(parseCommand("/start")).toEqual({ cmd: "start", token: null });
    expect(parseCommand("/start short")).toEqual({ cmd: "start", token: null });
    expect(parseCommand(`/start ${tok}' or 1=1`)).toEqual({ cmd: "start", token: null });
  });
  it("parses /issues company numbers", () => {
    expect(parseCommand("/issues")).toEqual({ cmd: "issues", companyNo: null, badArg: false });
    expect(parseCommand("/issues 3")).toEqual({ cmd: "issues", companyNo: 3, badArg: false });
    expect(parseCommand("/issues #12")).toEqual({ cmd: "issues", companyNo: 12, badArg: false });
    expect(parseCommand("/issues №2")).toEqual({ cmd: "issues", companyNo: 2, badArg: false });
    expect(parseCommand("/issues 0")).toEqual({ cmd: "issues", companyNo: null, badArg: true });
    expect(parseCommand("/issues abc")).toEqual({ cmd: "issues", companyNo: null, badArg: true });
    expect(parseCommand("/issues 99999")).toEqual({ cmd: "issues", companyNo: null, badArg: true });
    expect(parseCommand("/issues -1")).toEqual({ cmd: "issues", companyNo: null, badArg: true });
  });
});

describe("buildAccount", () => {
  it("numbers companies stably (orgs by name, then companies by name) and scores them", () => {
    const view = buildAccount(
      [orgA, orgB],
      [co("c2", "orgA", "Zeta"), co("c1", "orgA", "Alpha"), co("c3", "orgB", "Mid")],
      [fd("c2", "orgA", "2026-11-01"), fd("c2", "orgA", "2026-12-01"), fd("c3", "orgB", "2026-12-01")],
      ASOF, "en",
    );
    expect(view.map((o) => o.name)).toEqual(["Beta LLC", "Firm A"]);
    expect(view.flatMap((o) => o.companies.map((c) => [c.no, c.name]))).toEqual([[1, "Mid"], [2, "Alpha"], [3, "Zeta"]]);
    const zeta = view[1].companies[1];
    // probation-max is unverified → advisory (4 pts), overdue counts double: 100 - 8 - 4.
    expect(zeta).toMatchObject({ open: 2, overdue: 1, score: 88 });
    expect(zeta.issues[0].overdue).toBe(true);
    expect(view[1].companies[0]).toMatchObject({ open: 0, score: 100 });
    expect(view[1].score).toBe(94);
  });

  it("drops companies and findings of orgs the user is not a member of (defence in depth)", () => {
    const view = buildAccount(
      [orgA],
      [co("c1", "orgA", "Mine"), co("x1", "orgX", "Theirs")],
      [
        fd("c1", "orgA", "2026-12-01"),
        fd("x1", "orgX", "2026-12-01", { employee_name: "Secret" }),
        // A finding claiming to be orgA but pointing at another org's company.
        fd("x1", "orgA", "2026-12-01", { employee_name: "Secret" }),
      ],
      ASOF, "en",
    );
    expect(view).toHaveLength(1);
    expect(view[0].companies.map((c) => c.name)).toEqual(["Mine"]);
    expect(JSON.stringify(view)).not.toContain("Secret");
    expect(JSON.stringify(view)).not.toContain("Theirs");
  });

  it("skips findings whose rule left the catalog and localizes titles", () => {
    const view = buildAccount([orgA], [co("c1", "orgA", "Mine")], [fd("c1", "orgA", "2026-12-01"), fd("c1", "orgA", "2026-12-01", { rule_id: "gone" })], ASOF, "ru");
    expect(view[0].companies[0].open).toBe(1);
    expect(view[0].companies[0].issues[0].title).toBe(ruleById("probation-max").title.ru);
  });

  it("a company with 0 staff has a null score, left out of the org average, and says so in /status", () => {
    const view = buildAccount([orgA], [{ ...co("c1", "orgA", "Empty"), staff: 0 }, { ...co("c2", "orgA", "Full"), staff: 4 }], [fd("c2", "orgA", "2026-12-01")], ASOF, "en");
    expect(view[0].companies.find((c) => c.name === "Empty")?.score).toBeNull();
    expect(view[0].companies.find((c) => c.name === "Full")?.score).toBe(96);
    expect(view[0].score).toBe(96);
    expect(statusReply(view, "en")).toContain("No data yet");
    expect(statusReply(view, "en")).not.toContain("Empty</b>/100");
  });

  it("org without companies has a null score", () => {
    expect(buildAccount([orgA], [], [], ASOF, "en")[0].score).toBeNull();
  });
});

describe("sortIssues", () => {
  const i = (o: Partial<Issue>): Issue => ({ title: "t", severity: "advisory", dueDate: "2026-12-01", overdue: false, employeeName: "", companyName: "", ...o });
  it("overdue first, then severity, then due date", () => {
    const out = sortIssues([i({ dueDate: "2026-12-05" }), i({ severity: "red", dueDate: "2026-12-09" }), i({ overdue: true, dueDate: "2026-01-01" }), i({ dueDate: "2026-12-02" })]);
    expect(out.map((x) => [x.overdue, x.severity, x.dueDate])).toEqual([
      [true, "advisory", "2026-01-01"], [false, "red", "2026-12-09"], [false, "advisory", "2026-12-02"], [false, "advisory", "2026-12-05"],
    ]);
  });
});

describe("statusReply", () => {
  const view = (locale: "hy" | "ru" | "en") =>
    buildAccount([orgA, orgB], [co("c1", "orgA", "Alpha"), co("c3", "orgB", "Mid")], [fd("c1", "orgA", "2026-11-01")], ASOF, locale);

  it.each(LOCALES)("lists orgs, numbered companies, scores and open counts (%s)", (locale) => {
    const msg = statusReply(view(locale), locale);
    expect(msg).toContain(escapeHtml(T.score[locale]));
    expect(msg).toContain("<b>Firm A</b>");
    expect(msg).toMatch(/1\. 🟢 Mid — <b>100<\/b>\/100/);
    expect(msg).toMatch(/2\. 🟢 Alpha — <b>92<\/b>\/100/);
    expect(msg).toContain(`${escapeHtml(T.openFindings[locale])}: 1 (⏰ 1 ${T.overdue[locale]})`);
    expect(msg).toContain("/issues &lt;");
    expect(balanced(msg)).toBe(true);
  });

  it("says so when the user has no orgs or an org has no companies", () => {
    expect(statusReply([], "en")).toBe("You are not a member of any organisation yet.");
    const msg = statusReply(buildAccount([orgA], [], [], ASOF, "ru"), "ru");
    expect(msg).toContain("Компаний пока нет.");
    expect(msg).not.toContain("/issues");
  });

  it("escapes org and company names", () => {
    const msg = statusReply(buildAccount([{ ...orgA, name: "<b>A&B</b>" }], [co("c1", "orgA", `<a href="x">pwn</a>`)], [], ASOF, "en"), "en");
    expect(msg).toContain("&lt;b&gt;A&amp;B&lt;/b&gt;");
    expect(msg).not.toContain("<a ");
    expect(balanced(msg)).toBe(true);
  });

  it("stays under Telegram's limit with hundreds of companies, saying how many were left out", () => {
    const companies = Array.from({ length: 400 }, (_, k) => co(`c${k}`, "orgA", `Company with a fairly long name number ${String(k).padStart(3, "0")}`));
    const msg = statusReply(buildAccount([orgA], companies, [], ASOF, "en"), "en");
    expect(msg.length).toBeLessThanOrEqual(TELEGRAM_MAX);
    expect(msg).toMatch(/… and \d+ more/);
    expect(msg).toContain("Details: /issues");
    expect(balanced(msg)).toBe(true);
  });
});

describe("issuesReply", () => {
  const many = Array.from({ length: 8 }, (_, k) => fd("c1", "orgA", `2026-12-${String(10 + k).padStart(2, "0")}`, { employee_name: `Emp ${k}` }));
  const view = buildAccount([orgA], [co("c1", "orgA", "Alpha"), co("c2", "orgA", "Beta")], [...many, fd("c2", "orgA", "2026-11-01", { employee_name: "Late" })], ASOF, "hy");

  it.each(LOCALES)("shows the top 5 for one company with due dates and the disclaimer (%s)", (locale) => {
    const v = buildAccount([orgA], [co("c1", "orgA", "Alpha")], many, ASOF, locale);
    const msg = issuesReply(v, 1, locale);
    expect(msg).toContain("Alpha");
    expect((msg.match(/🟡/g) ?? []).length).toBe(ISSUES_LIMIT);
    expect(msg).toContain(ruleById("probation-max").title[locale]);
    expect(msg).toContain(`${T.due[locale]}: 10.12.2026`);
    expect(msg).not.toContain("Emp 7"); // 8th by due date is cut
    expect(msg).toContain(escapeHtml(T.andMore[locale](3)));
    expect(msg).toContain(`<i>${escapeHtml(DISCLAIMER[locale])}</i>`);
    expect(balanced(msg)).toBe(true);
  });

  it("without a number, ranks across all companies (overdue first) and names the company", () => {
    const msg = issuesReply(view, null, "hy");
    const first = msg.split("\n\n")[1];
    expect(first).toContain("Beta · Late");
    expect(first).toContain(`⏰ ${T.overdue.hy}`);
    expect(msg).toContain(escapeHtml(T.andMore.hy(4)));
  });

  it("reports unknown company numbers and empty companies", () => {
    expect(issuesReply(view, 9, "en")).toBe("Company #9 not found. Send /status to see the numbers.");
    const empty = buildAccount([orgA], [co("c1", "orgA", "Alpha")], [], ASOF, "en");
    expect(issuesReply(empty, 1, "en")).toContain(T.noFindings.en);
    expect(issuesReply(buildAccount([orgA], [], [], ASOF, "en"), null, "en")).toBe("No companies yet.");
    expect(issuesReply([], null, "en")).toContain("not a member");
  });

  it("escapes employee and company names", () => {
    const v = buildAccount([orgA], [co("c1", "orgA", "<i>Co")], [fd("c1", "orgA", "2026-12-01", { employee_name: "<script>alert(1)</script>" })], ASOF, "en");
    const msg = issuesReply(v, null, "en");
    expect(msg).not.toContain("<script>");
    expect(msg).toContain("&lt;i&gt;Co · &lt;script&gt;");
    expect(balanced(msg)).toBe(true);
  });
});

describe("fit", () => {
  it("drops whole entries and counts only countable ones", () => {
    const entries = [{ text: "\nH", countable: false }, ...Array.from({ length: 10 }, (_, k) => ({ text: `\nline ${k}`.padEnd(20, "."), countable: true }))];
    const out = fit("head", entries, "\nfoot", "en", 200);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.startsWith("head\nH")).toBe(true);
    expect(out.endsWith("\nfoot")).toBe(true);
    expect(out).toMatch(/… and \d more/);
  });
});

describe("help / linked replies", () => {
  it.each(LOCALES)("list every command (%s)", (locale) => {
    for (const msg of [helpReply(locale), linkedReply(locale)]) {
      for (const c of ["/status", "/issues", "/stop", "/help"]) expect(msg).toContain(c);
      expect(balanced(msg)).toBe(true);
    }
  });
  it("is in the user's language", () => {
    expect(helpReply("ru")).toContain("Команды");
    expect(helpReply("hy")).toContain("հրամաններ");
    expect(linkedReply("en")).toContain("Tesuch is connected");
    expect(linkedReply("en")).not.toContain("Тесуч подключён");
  });
});
