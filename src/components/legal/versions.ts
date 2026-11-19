/**
 * Current versions of the legal documents (DRAFTS pending a licensed Armenian lawyer).
 * Bump a version whenever the text of that document changes materially: every user is then asked
 * to accept again (the consent gate compares these against public.consent_records).
 */
export const LEGAL_VERSIONS = {
  terms: "2026-11-19-draft",
  privacy: "2026-11-19-draft",
  dpa: "2026-11-19-draft",
} as const;

export type LegalDocument = keyof typeof LEGAL_VERSIONS;

/** Documents every signed-in user must accept before using /app. The DPA is signed by firm owners separately. */
export const GATE_DOCUMENTS = ["terms", "privacy"] as const satisfies readonly LegalDocument[];

/** Date shown as "last updated" on the public pages (ISO). */
export const LEGAL_UPDATED_ON = "2026-11-19";

export interface ConsentRow {
  document: string;
  version: string;
}

/** Gate documents the user still has to accept at their current version. Pure, for tests and the gate. */
export function missingConsents(rows: readonly ConsentRow[]): LegalDocument[] {
  return GATE_DOCUMENTS.filter((d) => !rows.some((r) => r.document === d && r.version === LEGAL_VERSIONS[d]));
}
