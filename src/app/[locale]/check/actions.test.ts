import { beforeEach, describe, expect, it, vi } from "vitest";

// The action must call the RPC through the service-role client and recompute the score itself.
const rpc = vi.fn();
const supabaseService = vi.fn(() => ({ rpc }));
vi.mock("@/lib/supabase/server", () => ({ supabaseService: () => supabaseService() }));

const { submitLead } = await import("./actions");
const { CHECK_QUESTIONS } = await import("./questions");

const allGood = Object.fromEntries(CHECK_QUESTIONS.map((q) => [q.id, q.good]));
const base = { email: " Owner@Example.AM ", locale: "hy" as const, companySize: "firm" as const, role: "owner" as const, consent: true as const };

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ error: null });
  supabaseService.mockClear();
});

describe("submitLead", () => {
  it("recomputes the score from the answers and ignores any score the client sends", async () => {
    const forged = { ...base, answers: {}, score: 100 } as never;
    expect(await submitLead(forged)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("submit_lead", expect.objectContaining({ p_score: 0, p_email: "owner@example.am" }));

    await submitLead({ ...base, answers: allGood });
    expect(rpc).toHaveBeenLastCalledWith("submit_lead", expect.objectContaining({ p_score: 100 }));
  });

  it("uses the service-role client", async () => {
    await submitLead({ ...base, answers: allGood });
    expect(supabaseService).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid input before touching the database", async () => {
    expect(await submitLead({ ...base, email: "nope", answers: {} })).toEqual({ ok: false, reason: "invalid" });
    expect(await submitLead({ ...base, consent: false as never, answers: {} })).toEqual({ ok: false, reason: "invalid" });
    expect(await submitLead({ ...base, answers: { "not-a-rule": "yes" } as never })).toEqual({ ok: false, reason: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps database errors: P0429 throttled, 22023 invalid, anything else error", async () => {
    rpc.mockResolvedValueOnce({ error: { code: "P0429" } });
    expect(await submitLead({ ...base, answers: {} })).toEqual({ ok: false, reason: "throttled" });
    rpc.mockResolvedValueOnce({ error: { code: "22023" } });
    expect(await submitLead({ ...base, answers: {} })).toEqual({ ok: false, reason: "invalid" });
    rpc.mockResolvedValueOnce({ error: { code: "XX000" } });
    expect(await submitLead({ ...base, answers: {} })).toEqual({ ok: false, reason: "error" });
  });

  it("fails closed when server keys are missing", async () => {
    supabaseService.mockImplementationOnce(() => {
      throw new Error("missing env");
    });
    expect(await submitLead({ ...base, answers: {} })).toEqual({ ok: false, reason: "error" });
  });
});

describe("submitLead abuse guards", () => {
  it("silently drops a submission with the honeypot filled and never calls the database", async () => {
    expect(await submitLead({ ...base, answers: allGood, website: "http://spam.example" })).toEqual({ ok: true });
    expect(rpc).not.toHaveBeenCalled();
    expect(supabaseService).not.toHaveBeenCalled();
  });
  it("passes a visitor hash argument (null outside a request) and maps P0429 to throttled", async () => {
    rpc.mockResolvedValue({ error: { code: "P0429" } });
    expect(await submitLead({ ...base, answers: allGood })).toEqual({ ok: false, reason: "throttled" });
    expect(rpc).toHaveBeenCalledWith("submit_lead", expect.objectContaining({ p_ip_hash: null }));
  });
});

describe("submitLead before the migration", () => {
  it("retries without the visitor hash when the function has no such argument yet", async () => {
    rpc.mockResolvedValueOnce({ error: { code: "PGRST202" } }).mockResolvedValueOnce({ error: null });
    expect(await submitLead({ ...base, answers: allGood })).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1]).not.toHaveProperty("p_ip_hash");
  });
});
