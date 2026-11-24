import { describe, expect, it } from "vitest";
import {
  acceptErrorKey, auditHref, describeAudit, auditRange, envelope, exportFilename, inviteSchema, inviteUrl, jsonDownload, memberErrorKey, parseAuditQuery, supportInviteEmail, SUPPORT_INVITE_ROLE, TOKEN_RE,
} from "./lib";

describe("inviteSchema", () => {
  it("normalises the email", () => {
    expect(inviteSchema.parse({ email: "  Ani@Example.AM ", role: "viewer" })).toEqual({ email: "ani@example.am", role: "viewer" });
  });
  it("rejects bad emails and unknown roles", () => {
    expect(inviteSchema.safeParse({ email: "nope", role: "viewer" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.am", role: "admin" }).success).toBe(false);
  });
});

describe("invite links", () => {
  it("builds a locale link without double slashes", () => {
    expect(inviteUrl("https://x.am/", "ru", "ab")).toBe("https://x.am/ru/invite/ab");
  });
  it("accepts only 64-hex tokens", () => {
    expect(TOKEN_RE.test("a".repeat(64))).toBe(true);
    expect(TOKEN_RE.test("a".repeat(63))).toBe(false);
    expect(TOKEN_RE.test("../" + "a".repeat(61))).toBe(false);
  });
});

describe("error mapping", () => {
  it("maps database errors to UI keys", () => {
    expect(memberErrorKey("an org must keep at least one owner")).toBe("lastOwner");
    expect(memberErrorKey('duplicate key value violates unique constraint "invitations_one_pending"')).toBe("pending");
    expect(memberErrorKey("boom")).toBe("generic");
    expect(memberErrorKey(undefined)).toBe("generic");
    expect(acceptErrorKey("invitation not found")).toBe("notFound");
    expect(acceptErrorKey("invitation already used")).toBe("used");
    expect(acceptErrorKey("invitation expired")).toBe("expired");
    expect(acceptErrorKey("invitation is for another email")).toBe("mismatch");
    expect(acceptErrorKey("x")).toBe("generic");
  });
});

describe("audit query", () => {
  it("keeps only known filters and a sane page", () => {
    expect(parseAuditQuery({ page: "3", table: "employees", action: "delete" })).toEqual({ page: 3, table: "employees", action: "delete", system: false });
    expect(parseAuditQuery({ page: "-1", table: "auth.users", action: "drop" })).toEqual({ page: 1, table: undefined, action: undefined, system: false });
    expect(parseAuditQuery({ page: ["2", "9"] }).page).toBe(2);
    expect(parseAuditQuery({ page: "abc" }).page).toBe(1);
    expect(parseAuditQuery({ page: "99999999" }).page).toBe(1);
  });
  it("computes inclusive ranges", () => {
    expect(auditRange(1)).toEqual([0, 24]);
    expect(auditRange(3, 10)).toEqual([20, 29]);
  });
  it("keeps filters in page links", () => {
    expect(auditHref({ page: 1, table: "employees", system: false }, 2)).toBe("?table=employees&page=2");
    expect(auditHref({ page: 2, system: false }, 1)).toBe("?");
  });
});

describe("exports", () => {
  it("makes safe filenames", () => {
    expect(exportFilename("employee", "Արամ Petrosyan / \"x\"", "2026-11-19")).toBe("tesuch-employee-petrosyan-x-2026-11-19.json");
    expect(exportFilename("org", "Հայ", "2026-11-19")).toBe("tesuch-org-2026-11-19.json");
  });
  it("wraps data in a versioned envelope", () => {
    const e = envelope("org", { a: 1 }, new Date("2026-11-19T10:00:00Z"));
    expect(e).toEqual({ format: "tesuch-export", version: 1, kind: "org", exported_at: "2026-11-19T10:00:00.000Z", data: { a: 1 } });
  });
  it("returns a non-cacheable attachment", async () => {
    const r = jsonDownload({ a: 1 }, "f.json");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="f.json"');
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(await r.text())).toEqual({ a: 1 });
  });
});

describe("supportInviteEmail", () => {
  it("is hidden when unset, empty, blank or invalid", () => {
    for (const v of [undefined, "", "   ", "nope"]) expect(supportInviteEmail(v, true)).toBeNull();
  });
  it("is hidden for non-owners even when set", () => {
    expect(supportInviteEmail("help@tesuch.am", false)).toBeNull();
  });
  it("returns the normalised address for owners and pre-fills accountant", () => {
    expect(supportInviteEmail(" Help@Tesuch.AM ", true)).toBe("help@tesuch.am");
    expect(SUPPORT_INVITE_ROLE).toBe("accountant");
  });
});

describe("audit helpers", () => {
  it("system flag is read from the query and kept in links", () => {
    const q = parseAuditQuery({ system: "1" });
    expect(q.system).toBe(true);
    expect(auditHref(q, 2)).toBe("?system=1&page=2");
  });

  it("describes a row by name and lists changed fields, ignoring noise", () => {
    const d = describeAudit({ old_row: { id: "1", full_name: "Ա Բ", birth_date: "1990-01-01", six_day_week: false }, new_row: { id: "1", full_name: "Ա Բ", birth_date: "1991-01-01", six_day_week: false } });
    expect(d).toEqual({ name: "Ա Բ", changed: ["birth_date"] });
    expect(describeAudit({ new_row: { name: "Co" } })).toEqual({ name: "Co", changed: [] });
    expect(describeAudit({})).toEqual({ name: null, changed: [] });
  });
});
