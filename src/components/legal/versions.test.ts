import { describe, expect, it } from "vitest";
import { GATE_DOCUMENTS, LEGAL_VERSIONS, missingConsents } from "./versions";

describe("missingConsents", () => {
  it("requires terms and privacy when nothing is recorded", () => {
    expect(missingConsents([])).toEqual(["terms", "privacy"]);
  });
  it("is satisfied only by the current versions", () => {
    const current = GATE_DOCUMENTS.map((d) => ({ document: d, version: LEGAL_VERSIONS[d] }));
    expect(missingConsents(current)).toEqual([]);
    expect(missingConsents([{ document: "terms", version: "old" }, current[1]])).toEqual(["terms"]);
  });
  it("does not count the DPA towards the gate", () => {
    expect(missingConsents([{ document: "dpa", version: LEGAL_VERSIONS.dpa }])).toEqual(["terms", "privacy"]);
  });
  it("keeps versions within the database check", () => {
    for (const v of Object.values(LEGAL_VERSIONS)) expect(v).toMatch(/^[0-9A-Za-z._-]{1,32}$/);
  });
});
