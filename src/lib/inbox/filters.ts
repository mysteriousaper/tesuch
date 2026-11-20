// Pure filter / sort / grouping logic for the firm deadline inbox (F1). No database or React in here.
import { addDays, format, parseISO } from "date-fns";

export const INBOX_PAGE_SIZE = 50;
export const WINDOWS = ["7", "30", "all"] as const;
export const SEVERITIES = ["red", "amber", "advisory"] as const;
export const ASSIGNEES = ["any", "me", "unassigned"] as const;

export type InboxWindow = (typeof WINDOWS)[number];
export type InboxSeverity = (typeof SEVERITIES)[number] | "all";
export type InboxAssignee = (typeof ASSIGNEES)[number];

export interface InboxQuery {
  window: InboxWindow;
  /** Company id, or null for all companies. */
  company: string | null;
  severity: InboxSeverity;
  assignee: InboxAssignee;
  /** 1-based. */
  page: number;
}

export const DEFAULT_QUERY: InboxQuery = { window: "all", company: null, severity: "all", assignee: "any", page: 1 };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const oneOf = <T extends string>(list: readonly T[], v: string | undefined, fallback: T): T => (list as readonly string[]).includes(v ?? "") ? (v as T) : fallback;

/** Reads URL search params defensively: unknown values fall back to the defaults, a company must be a uuid. */
export function parseInboxQuery(sp: Record<string, string | string[] | undefined>): InboxQuery {
  const company = first(sp.company);
  const page = Number(first(sp.page));
  return {
    window: oneOf(WINDOWS, first(sp.window), DEFAULT_QUERY.window),
    company: company && UUID.test(company) ? company.toLowerCase() : null,
    severity: oneOf(["all", ...SEVERITIES] as const, first(sp.severity), "all"),
    assignee: oneOf(ASSIGNEES, first(sp.assignee), "any"),
    page: Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : 1,
  };
}

/** Query string for the non-default parts of a query (stable key order, so links are comparable). */
export function inboxSearch(q: InboxQuery, page = q.page): string {
  const p = new URLSearchParams();
  if (q.window !== DEFAULT_QUERY.window) p.set("window", q.window);
  if (q.company) p.set("company", q.company);
  if (q.severity !== "all") p.set("severity", q.severity);
  if (q.assignee !== "any") p.set("assignee", q.assignee);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Inclusive upper bound of the due-date window (yyyy-MM-dd), or null for "all". Overdue findings are always inside it. */
export function windowEnd(today: string, window: InboxWindow): string | null {
  return window === "all" ? null : format(addDays(parseISO(today), Number(window)), "yyyy-MM-dd");
}

/** Inclusive [from, to] row indexes for PostgREST `.range()`; the API caps a response at 1000 rows. */
export function pageRange(page: number, size = INBOX_PAGE_SIZE): [number, number] {
  const p = Math.max(1, Math.floor(page));
  return [(p - 1) * size, p * size - 1];
}

export const pageCount = (total: number, size = INBOX_PAGE_SIZE) => Math.max(1, Math.ceil(total / size));

export type InboxSeverityValue = "red" | "amber" | "advisory" | "info";
const SEV_ORDER: InboxSeverityValue[] = ["red", "amber", "advisory", "info"];

export interface InboxRow {
  id: string;
  due_date: string;
  severity: InboxSeverityValue;
  assignee_id?: string | null;
}

/** Info findings are reminders that never score; the inbox lists only things that need action. */
export const isInboxSeverity = (s: string): boolean => s !== "info";

/** Due date ascending (overdue therefore first), then more severe first, then id so the order is total and stable. */
export function compareRows(a: InboxRow, b: InboxRow): number {
  return a.due_date.localeCompare(b.due_date) || SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity) || a.id.localeCompare(b.id);
}

export const sortRows = <T extends InboxRow>(rows: readonly T[]): T[] => [...rows].sort(compareRows);

/** Client-side mirror of the server filters; the server applies the same rules in SQL. Info rows never pass. */
export function filterRows<T extends InboxRow>(rows: readonly T[], q: Pick<InboxQuery, "window" | "severity" | "assignee"> & { company?: string | null }, today: string, me: string | null): T[] {
  const end = windowEnd(today, q.window);
  return rows.filter((r) => {
    const co = (r as T & { company_id?: string }).company_id;
    if (!isInboxSeverity(r.severity)) return false;
    if (end && r.due_date > end) return false;
    if (q.severity !== "all" && r.severity !== q.severity) return false;
    if (q.company && co !== q.company) return false;
    if (q.assignee === "me" && (!me || r.assignee_id !== me)) return false;
    if (q.assignee === "unassigned" && r.assignee_id) return false;
    return true;
  });
}

/** Splits already sorted rows into the separate "Overdue" group (due before today) and the rest. */
export function groupRows<T extends InboxRow>(rows: readonly T[], today: string): { overdue: T[]; upcoming: T[] } {
  const overdue: T[] = [];
  const upcoming: T[] = [];
  for (const r of rows) (r.due_date < today ? overdue : upcoming).push(r);
  return { overdue, upcoming };
}
