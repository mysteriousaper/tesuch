import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEGAL_VERSIONS } from "./versions";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }) }));

// Minimal stand-in for the user-scoped Supabase client.
let user: { id: string } | null;
let existing: { data: { document: string; version: string }[] | null; error: { code: string } | null };
let insertError: { code: string } | null;
const insert = vi.fn(async () => ({ error: insertError }));
const db = {
  auth: { getUser: async () => ({ data: { user } }) },
  from: () => ({
    select: () => ({ eq: () => ({ in: async () => existing }) }),
    insert,
  }),
};
vi.mock("@/lib/supabase/server", () => ({ supabaseForUser: async () => db }));

const { recordConsent } = await import("./actions");
const { ipHash } = await import("./consent");

const ok = { locale: "hy", accepted: true };

beforeEach(() => {
  user = { id: "u1" };
  existing = { data: [], error: null };
  insertError = null;
  insert.mockClear();
  delete process.env.CONSENT_IP_SALT;
});

describe("recordConsent", () => {
  it("rejects input without an explicit acceptance", async () => {
    expect(await recordConsent({ locale: "hy", accepted: false })).toEqual({ ok: false, error: "invalid" });
    expect(await recordConsent({ locale: "de", accepted: true })).toEqual({ ok: false, error: "invalid" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    user = null;
    expect(await recordConsent(ok)).toEqual({ ok: false, error: "forbidden" });
  });

  it("records terms and privacy at the current versions, without an IP hash when no salt is set", async () => {
    expect(await recordConsent(ok)).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith([
      { user_id: "u1", document: "terms", version: LEGAL_VERSIONS.terms, ip_hash: null },
      { user_id: "u1", document: "privacy", version: LEGAL_VERSIONS.privacy, ip_hash: null },
    ]);
  });

  it("records only what is missing, and nothing when everything is current", async () => {
    existing = { data: [{ document: "terms", version: LEGAL_VERSIONS.terms }], error: null };
    await recordConsent(ok);
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ document: "privacy" })]);
    insert.mockClear();
    existing = { data: [{ document: "terms", version: LEGAL_VERSIONS.terms }, { document: "privacy", version: LEGAL_VERSIONS.privacy }], error: null };
    expect(await recordConsent(ok)).toEqual({ ok: true });
    expect(insert).not.toHaveBeenCalled();
  });

  it("treats a concurrent duplicate as success but reports other errors", async () => {
    insertError = { code: "23505" };
    expect(await recordConsent(ok)).toEqual({ ok: true });
    insertError = { code: "42501" };
    expect(await recordConsent(ok)).toEqual({ ok: false, error: "error" });
  });

  it("stores a keyed hash of the first forwarded IP when a salt is configured", async () => {
    process.env.CONSENT_IP_SALT = "test-salt-0123456789";
    await recordConsent(ok);
    const rows = (insert.mock.calls[0] as unknown as [{ ip_hash: string }[]])[0];
    expect(rows[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].ip_hash).toBe(ipHash("203.0.113.7"));
  });
});

describe("ipHash", () => {
  it("never returns the raw IP and needs a long enough salt", () => {
    expect(ipHash("203.0.113.7", undefined)).toBeNull();
    expect(ipHash("203.0.113.7", "short")).toBeNull();
    expect(ipHash(null, "test-salt-0123456789")).toBeNull();
    const h = ipHash("203.0.113.7, 10.0.0.1", "test-salt-0123456789");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(ipHash("203.0.113.7", "test-salt-0123456789"));
    expect(h).not.toBe(ipHash("203.0.113.8", "test-salt-0123456789"));
  });
});
