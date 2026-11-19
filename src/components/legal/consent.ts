import "server-only";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GATE_DOCUMENTS, missingConsents, type LegalDocument } from "./versions";

/** PostgREST / Postgres codes for "table does not exist" (migration not applied yet). */
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

/**
 * Which gate documents (terms, privacy) the signed-in user has not accepted at the current version.
 * RLS limits the query to the user's own rows.
 *
 * If the consent_records table does not exist yet (migration 20261119030000 not applied), it returns
 * [] so nobody is locked out of the app; any other error is treated as "not accepted".
 */
export async function missingConsentsFor(db: SupabaseClient, userId: string): Promise<LegalDocument[]> {
  const { data, error } = await db
    .from("consent_records")
    .select("document, version")
    .eq("user_id", userId)
    .in("document", [...GATE_DOCUMENTS]);
  if (error) {
    if (MISSING_TABLE.has(error.code ?? "")) {
      console.warn("consent_records table missing: consent gate disabled until migration 20261119030000 is applied");
      return [];
    }
    return [...GATE_DOCUMENTS];
  }
  return missingConsents(data ?? []);
}

/** True when the user has accepted the current Terms and Privacy notice. Use in the /app layout guard. */
export async function hasCurrentConsent(db: SupabaseClient, userId: string): Promise<boolean> {
  return (await missingConsentsFor(db, userId)).length === 0;
}

/**
 * Keyed hash of the client IP, so a record can be tied to a request without storing the address.
 * Without CONSENT_IP_SALT (>= 16 chars) nothing is stored: an unkeyed hash of an IPv4 address is trivially reversible.
 */
export function ipHash(forwardedFor: string | null, salt = process.env.CONSENT_IP_SALT): string | null {
  const ip = forwardedFor?.split(",")[0]?.trim();
  if (!ip || !salt || salt.length < 16) return null;
  return createHmac("sha256", salt).update(ip).digest("hex");
}
