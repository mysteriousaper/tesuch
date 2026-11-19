"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { supabaseForUser } from "@/lib/supabase/server";
import { ipHash, missingConsentsFor } from "./consent";
import { LEGAL_VERSIONS } from "./versions";

export type ConsentResult = { ok: true } | { ok: false; error: "invalid" | "forbidden" | "error" };

const input = z.object({
  locale: z.enum(["hy", "ru", "en"]),
  accepted: z.literal(true),
});

/**
 * Records that the signed-in user accepted the current Terms and Privacy notice.
 * Idempotent: only missing (document, version) pairs are inserted, and a concurrent duplicate
 * (unique violation) counts as success. Runs as the user, so RLS guarantees user_id = auth.uid().
 */
export async function recordConsent(raw: unknown): Promise<ConsentResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const db = await supabaseForUser();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: "forbidden" };

  const missing = await missingConsentsFor(db, user.id);
  if (!missing.length) return { ok: true };

  const hash = ipHash((await headers()).get("x-forwarded-for"));
  const { error } = await db
    .from("consent_records")
    .insert(missing.map((document) => ({ user_id: user.id, document, version: LEGAL_VERSIONS[document], ip_hash: hash })));
  if (error && error.code !== "23505") return { ok: false, error: "error" };
  return { ok: true };
}
