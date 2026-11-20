import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY, filterRows, groupRows, inboxSearch, INBOX_PAGE_SIZE, pageCount, pageRange, parseInboxQuery, sortRows, windowEnd, type InboxRow } from "./filters";

const CO = "11111111-1111-4111-8111-111111111111";
const row = (id: string, due_date: string, severity: InboxRow["severity"] = "advisory", extra: Partial<InboxRow & { company_id: string }> = {}) => ({ id, due_date, severity, ...extra });

describe("parseInboxQuery", () => {
  it("defaults", () => expect(parseInboxQuery({})).toEqual(DEFAULT_QUERY));
  it("reads valid values", () => {
    expect(parseInboxQuery({ window: "7", company: CO.toUpperCase(), severity: "red", assignee: "me", page: "3" }))
      .toEqual({ window: "7", company: CO, severity: "red", assignee: "me", page: 3 });
  });
  it("ignores junk and array values", () => {
    expect(parseInboxQuery({ window: "9", company: "x' or 1=1", severity: "info", assignee: "all", page: "-2" })).toEqual(DEFAULT_QUERY);
    expect(parseInboxQuery({ window: ["30", "7"], page: "1.5" })).toEqual({ ...DEFAULT_QUERY, window: "30" });
    expect(parseInboxQuery({ page: "abc" }).page).toBe(1);
  });
});

describe("inboxSearch", () => {
  it("is empty for defaults and keeps only non-default parts", () => {
    expect(inboxSearch(DEFAULT_QUERY)).toBe("");
    expect(inboxSearch({ ...DEFAULT_QUERY, window: "30", assignee: "unassigned" })).toBe("?window=30&assignee=unassigned");
    expect(inboxSearch({ ...DEFAULT_QUERY, page: 4 }, 2)).toBe("?page=2");
    expect(inboxSearch({ ...DEFAULT_QUERY, page: 4 }, 1)).toBe("");
  });
});

describe("windowEnd / paging", () => {
  it("adds days across month ends, null for all", () => {
    expect(windowEnd("2026-11-20", "7")).toBe("2026-11-27");
    expect(windowEnd("2026-11-20", "30")).toBe("2026-12-20");
    expect(windowEnd("2026-12-28", "7")).toBe("2027-01-04");
    expect(windowEnd("2026-11-20", "all")).toBeNull();
  });
  it("ranges are inclusive and stay under the API cap", () => {
    expect(pageRange(1)).toEqual([0, 49]);
    expect(pageRange(3)).toEqual([100, 149]);
    expect(pageRange(0)).toEqual([0, 49]);
    expect(INBOX_PAGE_SIZE).toBeLessThanOrEqual(1000);
    expect(pageCount(0)).toBe(1);
    expect(pageCount(50)).toBe(1);
    expect(pageCount(51)).toBe(2);
    expect(pageCount(1234)).toBe(25);
  });
});

describe("sortRows", () => {
  it("due ascending, then severity, then id; does not mutate", () => {
    const input = [row("c", "2026-12-01", "advisory"), row("b", "2026-11-01", "amber"), row("a", "2026-11-01", "red"), row("d", "2026-11-01", "red")];
    const out = sortRows(input);
    expect(out.map((r) => r.id)).toEqual(["a", "d", "b", "c"]);
    expect(input[0].id).toBe("c");
  });
});

describe("filterRows", () => {
  const today = "2026-11-20";
  const rows = [
    row("old", "2026-11-01", "red", { company_id: CO, assignee_id: "me" }),
    row("soon", "2026-11-25", "amber", { company_id: CO }),
    row("later", "2026-12-15", "advisory", { company_id: "other", assignee_id: "you" }),
    row("far", "2027-03-01", "advisory", { company_id: "other" }),
    row("info", "2026-11-21", "info", { company_id: CO }),
  ];
  const base = { window: "all", severity: "all", assignee: "any", company: null } as const;
  it("hides info and keeps everything else for all", () => expect(filterRows(rows, base, today, "me").map((r) => r.id)).toEqual(["old", "soon", "later", "far"]));
  it("7-day window keeps overdue and due within 7 days", () => expect(filterRows(rows, { ...base, window: "7" }, today, "me").map((r) => r.id)).toEqual(["old", "soon"]));
  it("30-day window", () => expect(filterRows(rows, { ...base, window: "30" }, today, "me").map((r) => r.id)).toEqual(["old", "soon", "later"]));
  it("severity and company", () => {
    expect(filterRows(rows, { ...base, severity: "advisory" }, today, "me").map((r) => r.id)).toEqual(["later", "far"]);
    expect(filterRows(rows, { ...base, company: CO }, today, "me").map((r) => r.id)).toEqual(["old", "soon"]);
  });
  it("assignee me / unassigned", () => {
    expect(filterRows(rows, { ...base, assignee: "me" }, today, "me").map((r) => r.id)).toEqual(["old"]);
    expect(filterRows(rows, { ...base, assignee: "me" }, today, null)).toEqual([]);
    expect(filterRows(rows, { ...base, assignee: "unassigned" }, today, "me").map((r) => r.id)).toEqual(["soon", "far"]);
  });
});

describe("groupRows", () => {
  it("separates overdue (strictly before today); due today is not overdue", () => {
    const sorted = sortRows([row("a", "2026-11-19"), row("b", "2026-11-20"), row("c", "2026-11-21")]);
    const g = groupRows(sorted, "2026-11-20");
    expect(g.overdue.map((r) => r.id)).toEqual(["a"]);
    expect(g.upcoming.map((r) => r.id)).toEqual(["b", "c"]);
  });
  it("handles empty", () => expect(groupRows([], "2026-11-20")).toEqual({ overdue: [], upcoming: [] }));
});
