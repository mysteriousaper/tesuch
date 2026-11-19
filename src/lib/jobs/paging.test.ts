import { describe, expect, it } from "vitest";
import { readAll } from "./paging";

const source = (total: number) => {
  const all = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  return { calls, fetch: async (from: number, to: number) => { calls.push([from, to]); return { data: all.slice(from, to + 1), error: null }; } };
};

describe("readAll", () => {
  it("reads all 2500 rows, not just the first 1000", async () => {
    const s = source(2500);
    expect(await readAll(s.fetch)).toHaveLength(2500);
    expect(s.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it("reads 1001 rows (one over the cap)", async () => {
    expect(await readAll(source(1001).fetch)).toHaveLength(1001);
  });
  it("stops after one request when under the cap, and when empty", async () => {
    const s = source(999);
    expect(await readAll(s.fetch)).toHaveLength(999);
    expect(s.calls).toHaveLength(1);
    expect(await readAll(source(0).fetch)).toEqual([]);
  });
  it("needs one extra empty request when the total is an exact multiple", async () => {
    const s = source(2000);
    expect(await readAll(s.fetch)).toHaveLength(2000);
    expect(s.calls).toHaveLength(3);
  });
  it("throws on error", async () => {
    await expect(readAll(async () => ({ data: null, error: { message: "boom" } }))).rejects.toThrow("boom");
  });
});
