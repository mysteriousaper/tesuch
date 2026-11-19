import { describe, expect, it } from "vitest";
import { chunk, groupByPatch, patchJobs, runPool } from "./batch";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id${i}`);

describe("chunk", () => {
  it("splits 1500 ids into 8 chunks of <=200, lossless and ordered", () => {
    const c = chunk(ids(1500), 200);
    expect(c).toHaveLength(8);
    expect(c.every((x) => x.length <= 200)).toBe(true);
    expect(c[7]).toHaveLength(100);
    expect(c.flat()).toEqual(ids(1500));
  });
  it("handles empty and exact multiples", () => {
    expect(chunk([], 200)).toEqual([]);
    expect(chunk(ids(400), 200)).toHaveLength(2);
  });
  it("rejects bad size", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("groupByPatch", () => {
  const rows = [
    { id: "a", v: 2, s: "red" },
    { id: "b", v: 2, s: "red" },
    { id: "c", v: 2, s: "amber" },
    { id: "d", v: 2, s: "red" },
  ];
  it("groups identical patches regardless of key order", () => {
    const g = groupByPatch(rows, (r) => (r.id === "b" ? { s: r.s, v: r.v } : { v: r.v, s: r.s }));
    expect(g).toHaveLength(2);
    expect(g[0].ids).toEqual(["a", "b", "d"]);
    expect(g[1]).toEqual({ patch: { v: 2, s: "amber" }, ids: ["c"] });
  });
  it("keeps every id exactly once across groups", () => {
    const g = groupByPatch(rows, (r) => ({ s: r.s }));
    expect(g.flatMap((x) => x.ids).sort()).toEqual(["a", "b", "c", "d"]);
  });
});

describe("patchJobs", () => {
  it("1500 same-patch ids give 8 jobs; differing groups chunk separately", () => {
    const rows = [...ids(1500).map((id) => ({ id, p: 1 })), { id: "x", p: 2 }];
    const jobs = patchJobs(groupByPatch(rows, (r) => ({ p: r.p })), 200);
    expect(jobs).toHaveLength(9);
    expect(jobs.filter((j) => j.patch.p === 1)).toHaveLength(8);
    expect(jobs.at(-1)).toEqual({ patch: { p: 2 }, ids: ["x"] });
    expect(jobs.every((j) => j.ids.length <= 200)).toBe(true);
  });
});

describe("runPool", () => {
  it("respects the limit and keeps order", async () => {
    let active = 0, peak = 0;
    const out = await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBeLessThanOrEqual(3);
  });
  it("rejects on first error and stops starting tasks", async () => {
    const started: number[] = [];
    await expect(runPool([1, 2, 3, 4, 5, 6], 1, async (n) => { started.push(n); if (n === 2) throw new Error("boom"); }))
      .rejects.toThrow("boom");
    expect(started).toEqual([1, 2]);
  });
});
