import { describe, expect, it, vi } from "vitest";
import type { Finding } from "../rules/types";
import { citation, DISCLAIMER, escapeHtml, formatDate, LOCALES } from "./i18n";
import { emailAlert, emailDigest, TELEGRAM_MAX, telegramAlert, telegramDigest, type AlertItem } from "./messages";
import { sendEmailResend, sendTelegram, verifyTelegramSecret, type FetchLike } from "./send";

const finding = (o: Partial<Finding> = {}): Finding => ({
  ruleId: "probation-max", ruleVersion: 1, article: "92", sourceUrl: "https://www.arlis.am/",
  ruleStatus: "needs_lawyer_review", severity: "advisory", companyId: "co1", employeeId: "e1",
  contractId: "c1", dueDate: "2026-04-15", overdue: false, ...o,
});
const item = (o: Partial<Finding> = {}, names: Partial<AlertItem> = {}): AlertItem => ({
  finding: finding(o), companyName: "Արարատ ՍՊԸ", employeeName: "Test Employee", ...names,
});

describe("i18n helpers", () => {
  it("formats dates as dd.mm.yyyy", () => expect(formatDate("2026-04-05")).toBe("05.04.2026"));
  it("escapes HTML", () => expect(escapeHtml(`<b>"A&B"</b>`)).toBe("&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;"));
  it("never invents an article", () => {
    expect(citation({ article: null, status: "needs_lawyer_review" }, "en")).toBe("article pending lawyer review");
    expect(citation({ article: "92", status: "needs_lawyer_review" }, "hy")).toContain("հոդված 92");
    expect(citation({ article: "92", status: "needs_lawyer_review" }, "en")).toContain("subject to lawyer review");
    expect(citation({ article: "92", status: "verified" }, "en")).toBe("RA Labour Code, Art. 92");
  });
});

describe("telegram messages", () => {
  it.each(LOCALES)("advisory alert includes title, article, arlis link and disclaimer (%s)", (locale) => {
    const msg = telegramAlert(item(), locale);
    expect(msg).toContain('<a href="https://www.arlis.am/">arlis.am</a>');
    expect(msg).toContain("92");
    expect(msg).toContain(escapeHtml(DISCLAIMER[locale]));
    expect(msg).toContain("15.04.2026");
  });
  it("uses 'pending' wording for rules without an article", () => {
    expect(telegramAlert(item({ ruleId: "notice-period", article: null }), "en")).toContain("article pending lawyer review");
  });
  it("escapes user-supplied names", () => {
    const msg = telegramAlert(item({}, { companyName: "<script>x</script>" }), "en");
    expect(msg).not.toContain("<script>");
    expect(msg).toContain("&lt;script&gt;");
  });
  it("omits the disclaimer for verified, non-advisory findings", () => {
    expect(telegramAlert(item({ ruleStatus: "verified", severity: "red" }), "en")).not.toContain(DISCLAIMER.en);
  });
  it("marks overdue", () => expect(telegramAlert(item({ overdue: true }), "ru")).toContain("просрочено"));

  it("digest sorts companies worst-first, caps items per company and praises clean ones", () => {
    const msg = telegramDigest(
      [
        { companyName: "Good Co", score: 100, items: [] },
        { companyName: "Bad Co", score: 40, items: [1, 2, 3, 4, 5].map((n) => item({ employeeId: `e${n}` })) },
      ],
      "en",
    );
    expect(msg.indexOf("Bad Co")).toBeLessThan(msg.indexOf("Good Co"));
    expect(msg).toContain("and 2 more");
    expect(msg).toContain("No open findings");
  });
  it("digest stays under Telegram's limit and reports omitted companies", () => {
    const companies = Array.from({ length: 60 }, (_, i) => ({
      companyName: `Company ${i}`, score: i, items: [item(), item(), item()],
    }));
    const msg = telegramDigest(companies, "hy");
    expect(msg.length).toBeLessThanOrEqual(TELEGRAM_MAX);
    expect(msg).toMatch(/և ևս \d+/);
    expect(msg).toContain(escapeHtml(DISCLAIMER.hy));
  });
});

describe("email messages", () => {
  it.each(LOCALES)("alert has subject, html and text (%s)", (locale) => {
    const m = emailAlert(item(), locale);
    expect(m.subject).toContain("Արարատ ՍՊԸ");
    expect(m.html).toContain(`lang="${locale}"`);
    expect(m.html).toContain("https://www.arlis.am/");
    expect(m.text).toContain(DISCLAIMER[locale]);
  });
  it("digest counts open findings and escapes html", () => {
    const m = emailDigest([{ companyName: "A & B", score: 50, items: [item(), item()] }], "en");
    expect(m.subject).toContain("Open findings: 2");
    expect(m.html).toContain("A &amp; B");
    expect(m.text).toContain("A & B");
  });
});

describe("senders", () => {
  const okFetch = () => vi.fn<FetchLike>(async () => new Response("{}", { status: 200 }));

  it("posts to Telegram with HTML parse mode", async () => {
    const f = okFetch();
    expect(await sendTelegram("T0KEN", 42, "<b>hi</b>", f)).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/botT0KEN/sendMessage");
    expect(JSON.parse(init.body as string)).toMatchObject({ chat_id: 42, parse_mode: "HTML", text: "<b>hi</b>" });
  });
  it("reports failures without the token", async () => {
    const f = vi.fn<FetchLike>(async () => new Response("Bad Request: chat not found", { status: 400 }));
    const r = await sendTelegram("SECRET_TOKEN", 1, "x", f);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("400");
    expect(r.error).not.toContain("SECRET_TOKEN");
  });
  it("turns network errors into a result", async () => {
    const r = await sendTelegram("t", 1, "x", async () => { throw new Error("ECONNRESET"); });
    expect(r).toEqual({ ok: false, error: "ECONNRESET" });
  });
  it("posts to Resend with a bearer key", async () => {
    const f = okFetch();
    await sendEmailResend("re_key", { from: "a@x.am", to: "b@x.am", subject: "s", html: "<p>h</p>", text: "h" }, f);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_key");
  });
  it("verifies the Telegram webhook secret", () => {
    expect(verifyTelegramSecret("abc123", "abc123")).toBe(true);
    expect(verifyTelegramSecret("abc124", "abc123")).toBe(false);
    expect(verifyTelegramSecret("abc", "abc123")).toBe(false);
    expect(verifyTelegramSecret(null, "abc123")).toBe(false);
    expect(verifyTelegramSecret("", "")).toBe(false);
    expect(verifyTelegramSecret("x", undefined)).toBe(false);
  });
});
