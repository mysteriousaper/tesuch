// Official labour inspection checklist N 5.1 (102 questions): which ones Tesuch checks with a rule, which need a paper.
// The data lives in rules/checklist/N5.1.json so "Tesuch checks X of 102" is computed, never hand-written.
import { z } from "zod";
import data from "../../../rules/checklist/N5.1.json";

const localized = z.object({ hy: z.string().min(1), ru: z.string().min(1), en: z.string().min(1) });

const schema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  title: localized,
  source: z.string(),
  source_note: z.string(),
  total_weight: z.number(),
  groups: z.record(z.string(), localized),
  questions: z.array(z.object({
    no: z.string().regex(/^[0-9]{1,2}(\.[0-9]{1,2})?$/),
    weight: z.number().positive(),
    basis: z.string(),
    group: z.string(),
    text: localized,
    /** Rule ids that check (part of) the question, or "document": the owner keeps the paper ready. */
    covered_by: z.union([z.literal("document"), z.array(z.string()).min(1)]),
    /** A document item a future rule could check once the data exists. */
    automatable: z.boolean().optional(),
  })).min(1),
});

export const CHECKLIST = schema.parse(data);
export type ChecklistQuestion = (typeof CHECKLIST.questions)[number];

export const isDocumentItem = (q: ChecklistQuestion) => q.covered_by === "document";

/** Questions the owner prepares a document or on-site proof for. */
export const DOCUMENT_ITEMS: ChecklistQuestion[] = CHECKLIST.questions.filter(isDocumentItem);

/** Items a Tesuch rule checks (in part): `checked` of `total`. */
export function checklistCoverage(): { checked: number; total: number } {
  return { checked: CHECKLIST.questions.filter((q) => !isDocumentItem(q)).length, total: CHECKLIST.questions.length };
}

/** Document items grouped in checklist order. */
export function documentGroups(): { group: string; items: ChecklistQuestion[] }[] {
  const out: { group: string; items: ChecklistQuestion[] }[] = [];
  for (const q of DOCUMENT_ITEMS) {
    const last = out.at(-1);
    if (last && last.group === q.group) last.items.push(q);
    else out.push({ group: q.group, items: [q] });
  }
  return out;
}

export const isDocumentQuestionNo = (no: string) => DOCUMENT_ITEMS.some((q) => q.no === no);

/** For alerts and PDFs (no message catalog there). */
export function checklistCoverageLine(locale: "hy" | "ru" | "en"): string {
  const { checked, total } = checklistCoverage();
  return {
    hy: `Տեսուչը մասնակիորեն ստուգում է աշխատանքային տեսչության պաշտոնական ստուգաթերթի ${total} կետից ${checked}-ը։ Մնացածը Ձեր փաստաթղթերն են։`,
    ru: `Тесуч частично проверяет ${checked} из ${total} пунктов официального проверочного листа трудовой инспекции. Остальное: ваши документы.`,
    en: `Tesuch checks, in part, ${checked} of ${total} items of the official labour inspection checklist. The rest are your documents.`,
  }[locale];
}
