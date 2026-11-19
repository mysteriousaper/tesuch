import { describe, expect, it } from "vitest";
import { yerevanToday } from "./yerevan-date";

describe("yerevanToday", () => {
  it("uses Armenia's date (UTC+4), not the server's", () => {
    expect(yerevanToday(new Date("2026-11-18T19:59:00Z"))).toBe("2026-11-18");
    expect(yerevanToday(new Date("2026-11-18T20:00:00Z"))).toBe("2026-11-19");
  });
  it("crosses the year boundary", () => {
    expect(yerevanToday(new Date("2026-12-31T21:00:00Z"))).toBe("2027-01-01");
  });
});
