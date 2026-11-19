import type { ContractType, IsoDate, TerminationInitiator } from "../rules/types";
import { normalizeHeader } from "./fields";

/** A cell as delivered by papaparse (string) or read-excel-file (string | number | boolean | Date). */
export type RawCell = string | number | boolean | Date | null | undefined;

export type Parsed<T> = { ok: true; value: T } | { ok: false };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = { ok: false } as const;

export function isBlank(v: RawCell): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

const pad = (n: number) => String(n).padStart(2, "0");

function isoIfValid(y: number, m: number, d: number): IsoDate | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Excel 1900 date system. Excel counts a non-existent 29 Feb 1900, so from serial 61 (1 Mar 1900)
 * on, day 0 is 1899-12-30. Earlier serials are ambiguous and irrelevant for HR data: rejected.
 */
export function excelSerialToIso(serial: number): IsoDate | null {
  if (!Number.isFinite(serial) || serial < 61 || serial > 73050) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
  const dt = new Date(ms);
  return isoIfValid(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/**
 * Dates: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY (day first, the Armenian/Russian convention),
 * YYYY-MM-DD (optionally with a time part), Excel serial numbers and Date objects.
 */
export function parseDate(v: RawCell): Parsed<IsoDate | null> {
  if (v == null || isBlank(v)) return ok(null);
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return fail;
    // read-excel-file returns dates at UTC midnight.
    const iso = isoIfValid(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
    return iso ? ok(iso) : fail;
  }
  if (typeof v === "number") {
    const iso = excelSerialToIso(v);
    return iso ? ok(iso) : fail;
  }
  if (typeof v === "boolean") return fail;
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) {
    const iso = isoIfValid(+m[1], +m[2], +m[3]);
    return iso ? ok(iso) : fail;
  }
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (m) {
    const iso = isoIfValid(+m[3], +m[2], +m[1]);
    return iso ? ok(iso) : fail;
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const iso = excelSerialToIso(Number(s));
    return iso ? ok(iso) : fail;
  }
  return fail;
}

const TRUE_WORDS = new Set(["yes", "y", "true", "1", "+", "x", "✓", "այո", "հա", "да", "д", "истина"]);
const FALSE_WORDS = new Set(["no", "n", "false", "0", "-", "ոչ", "չէ", "нет", "н", "ложь"]);

/** Booleans: այո/ոչ, да/нет, yes/no, 1/0. Empty means unknown (null), never false. */
export function parseBool(v: RawCell): Parsed<boolean | null> {
  if (v == null || isBlank(v)) return ok(null);
  if (typeof v === "boolean") return ok(v);
  if (typeof v === "number") return v === 1 ? ok(true) : v === 0 ? ok(false) : fail;
  if (v instanceof Date) return fail;
  const s = v.trim().normalize("NFC").toLocaleLowerCase();
  if (TRUE_WORDS.has(s)) return ok(true);
  if (FALSE_WORDS.has(s)) return ok(false);
  return fail;
}

const CONTRACT_TYPES: Record<string, ContractType> = Object.fromEntries([
  ...["indefinite", "permanent", "open ended", "unlimited", "անորոշ", "անորոշ ժամկետով", "անժամկետ", "бессрочный", "бессрочно", "бессрочный договор", "на неопределенный срок", "на неопределённый срок"].map((w) => [normalizeHeader(w), "indefinite" as const]),
  ...["fixed term", "fixed", "temporary", "որոշակի ժամկետով", "ժամկետային", "որոշակի ժամկետ", "срочный", "срочный договор", "на определенный срок", "на определённый срок"].map((w) => [normalizeHeader(w), "fixed_term" as const]),
]);

/** Contract type words in hy/ru/en. Empty → null (the pipeline infers it from the end date). */
export function parseContractType(v: RawCell): Parsed<ContractType | null> {
  if (isBlank(v)) return ok(null);
  const t = CONTRACT_TYPES[normalizeHeader(String(v))];
  return t ? ok(t) : fail;
}

const INITIATORS: Record<string, TerminationInitiator> = Object.fromEntries([
  ...["employer", "company", "գործատու", "գործատուի նախաձեռնությամբ", "работодатель", "по инициативе работодателя"].map((w) => [normalizeHeader(w), "employer" as const]),
  ...["employee", "resignation", "աշխատող", "սեփական ցանկությամբ", "աշխատողի նախաձեռնությամբ", "работник", "по собственному желанию"].map((w) => [normalizeHeader(w), "employee" as const]),
  ...["mutual", "mutual agreement", "agreement", "կողմերի համաձայնությամբ", "համաձայնությամբ", "по соглашению сторон", "соглашение сторон"].map((w) => [normalizeHeader(w), "mutual" as const]),
]);

export function parseInitiator(v: RawCell): Parsed<TerminationInitiator | null> {
  if (isBlank(v)) return ok(null);
  const t = INITIATORS[normalizeHeader(String(v))];
  return t ? ok(t) : fail;
}

/** Fixed-term ground: blank = unknown (null); an explicit "none" word = "" (stated as absent); else the text. */
const NONE_WORDS = new Set(["none", "no", "n a", "n/a", "ոչ", "չկա", "нет", "отсутствует"]);
export function parseGround(v: RawCell, max = 500): Parsed<string | null> {
  const t = parseText(v, max);
  if (!t.ok || t.value === null) return t;
  return ok(NONE_WORDS.has(normalizeHeader(t.value)) ? "" : t.value);
}

export function parseText(v: RawCell, max = 500): Parsed<string | null> {
  if (isBlank(v)) return ok(null);
  if (v instanceof Date) return fail;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.length <= max ? ok(s) : fail;
}
