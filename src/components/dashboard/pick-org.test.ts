import { describe, expect, it } from "vitest";
import { pickOrg, type OrgInfo } from "./pick-org";

const a: OrgInfo = { id: "a", name: "A", locale: "hy", role: "owner" };
const b: OrgInfo = { id: "b", name: "B", locale: "ru", role: "viewer" };

describe("pickOrg", () => {
  it("uses the preferred org when the user is a member", () => {
    expect(pickOrg([a, b], "b")).toBe(b);
  });
  it("ignores a cookie pointing at someone else's org", () => {
    expect(pickOrg([a, b], "not-mine")).toBe(a);
  });
  it("falls back to the first org without a cookie", () => {
    expect(pickOrg([a, b], undefined)).toBe(a);
  });
  it("returns null for a user without orgs", () => {
    expect(pickOrg([], "a")).toBeNull();
  });
});
