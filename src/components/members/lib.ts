// Pure helpers for members, invitations, the audit viewer and data exports (unit-tested, no I/O).
import { z } from "zod";

export const ROLES = ["owner", "accountant", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().max(320).email(),
  role: z.enum(ROLES),
});

export const roleChangeSchema = z.object({ user_id: z.string().uuid(), role: z.enum(ROLES) });

/**
 * Assisted onboarding: the support address for the owner-only "Invite Tesuch" card.
 * Returns null (card hidden) when unset, blank or not a valid email; never trusts client input.
 */
export function supportInviteEmail(raw: string | undefined, isOwner: boolean): string | null {
  if (!isOwner) return null;
  const parsed = inviteSchema.shape.email.safeParse(raw ?? "");
  return parsed.success ? parsed.data : null;
}

/** Role pre-filled for assisted onboarding. */
export const SUPPORT_INVITE_ROLE: Role = "accountant";

/** Invite tokens are 64 lowercase hex characters (see the migration). */
export const TOKEN_RE = /^[0-9a-f]{64}$/;

export function inviteUrl(base: string, locale: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/${locale}/invite/${token}`;
}

/** Maps a Postgres error message from the members migration to a UI error key. */
export function memberErrorKey(message: string | undefined): "lastOwner" | "pending" | "generic" {
  if (!message) return "generic";
  if (message.includes("at least one owner")) return "lastOwner";
  if (message.includes("invitations_one_pending")) return "pending";
  return "generic";
}

export type AcceptError = "notFound" | "used" | "expired" | "mismatch" | "generic";
export function acceptErrorKey(message: string | undefined): AcceptError {
  if (!message) return "generic";
  if (message.includes("not found")) return "notFound";
  if (message.includes("already used")) return "used";
  if (message.includes("expired")) return "expired";
  if (message.includes("another email")) return "mismatch";
  return "generic";
}

// ---------- Audit viewer ----------
export const AUDIT_TABLES = ["memberships", "invitations", "companies", "employees", "contracts", "leave_records", "findings", "templates", "quiz_attempts"] as const;
export const AUDIT_ACTIONS = ["insert", "update", "delete"] as const;
export const AUDIT_PAGE_SIZE = 25;

export interface AuditQuery {
  page: number;
  table?: (typeof AUDIT_TABLES)[number];
  action?: (typeof AUDIT_ACTIONS)[number];
}

/** Reads untrusted search params; anything unknown is ignored rather than passed to the database. */
export function parseAuditQuery(sp: Record<string, string | string[] | undefined>): AuditQuery {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const page = Number.parseInt(one(sp.page) ?? "1", 10);
  const table = AUDIT_TABLES.find((t) => t === one(sp.table));
  const action = AUDIT_ACTIONS.find((a) => a === one(sp.action));
  return { page: Number.isFinite(page) && page >= 1 && page <= 10_000 ? page : 1, table, action };
}

export function auditRange(page: number, size = AUDIT_PAGE_SIZE): [number, number] {
  return [(page - 1) * size, page * size - 1];
}

/** Query string for a page link that keeps the current filters. */
export function auditHref(q: AuditQuery, page: number): string {
  const p = new URLSearchParams();
  if (q.table) p.set("table", q.table);
  if (q.action) p.set("action", q.action);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `?${s}` : "?";
}

// ---------- Exports ----------
/** Safe ASCII filename for a Content-Disposition header. */
export function exportFilename(kind: string, label: string, date: string): string {
  const slug = label.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 40);
  return `tesuch-${kind}${slug ? `-${slug}` : ""}-${date}.json`;
}

export interface ExportEnvelope<T> {
  format: "tesuch-export";
  version: 1;
  kind: "employee" | "org";
  exported_at: string;
  data: T;
}

export function envelope<T>(kind: "employee" | "org", data: T, now = new Date()): ExportEnvelope<T> {
  return { format: "tesuch-export", version: 1, kind, exported_at: now.toISOString(), data };
}

export function jsonDownload(body: unknown, filename: string): Response {
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
