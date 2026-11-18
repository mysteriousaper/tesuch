import { FIELD_ALIASES, normalizeHeader, TARGET_FIELDS, type TargetField } from "./fields";

export interface ColumnGuess {
  column: number;
  header: string;
  field: TargetField | null;
  /** 1 = exact alias match, 0.5–0.9 = partial match, 0 = unmapped. */
  confidence: number;
}

/** Column index → target field. Users edit this in the mapping wizard. */
export type ColumnMapping = Record<number, TargetField | null>;

function score(header: string, alias: string): number {
  if (!header) return 0;
  if (header === alias) return 1;
  // Short aliases ("id", "src", "кгд") only match exactly, to avoid false hits inside other words.
  if (alias.length < 4) return 0;
  const words = ` ${header} `;
  if (words.includes(` ${alias} `)) return 0.5 + 0.4 * (alias.length / header.length);
  return 0;
}

/** Guess a field for each header. Each field is used at most once; the best-scoring pair wins. */
export function autoMap(headers: string[]): ColumnGuess[] {
  const normalized = headers.map((h) => normalizeHeader(String(h ?? "")));
  const candidates: { column: number; field: TargetField; score: number; aliasLen: number }[] = [];
  normalized.forEach((h, column) => {
    for (const field of TARGET_FIELDS) {
      for (const raw of FIELD_ALIASES[field]) {
        const alias = normalizeHeader(raw);
        const s = score(h, alias);
        if (s > 0) candidates.push({ column, field, score: s, aliasLen: alias.length });
      }
    }
  });
  candidates.sort((a, b) => b.score - a.score || b.aliasLen - a.aliasLen || a.column - b.column);

  const guesses: ColumnGuess[] = headers.map((header, column) => ({ column, header: String(header ?? ""), field: null, confidence: 0 }));
  const usedFields = new Set<TargetField>();
  for (const c of candidates) {
    if (usedFields.has(c.field) || guesses[c.column].field !== null) continue;
    guesses[c.column] = { ...guesses[c.column], field: c.field, confidence: Math.round(c.score * 100) / 100 };
    usedFields.add(c.field);
  }
  return guesses;
}

export function toMapping(guesses: ColumnGuess[]): ColumnMapping {
  return Object.fromEntries(guesses.map((g) => [g.column, g.field]));
}

/** Fields the import cannot work without. Name may come from full_name or first+last name. */
export function missingRequiredFields(mapping: ColumnMapping): TargetField[] {
  const mapped = new Set(Object.values(mapping).filter((f): f is TargetField => f !== null));
  const missing: TargetField[] = [];
  if (!mapped.has("full_name") && !(mapped.has("first_name") && mapped.has("last_name"))) missing.push("full_name");
  if (!mapped.has("start_date")) missing.push("start_date");
  return missing;
}
