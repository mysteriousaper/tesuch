import { z } from "zod";

const localized = z.object({ hy: z.string().min(1), ru: z.string().min(1), en: z.string().min(1) });

export const DATE_ANCHORS = ["asOf", "probationEnd", "contractEnd"] as const;

export const ruleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.number().int().positive(),
    // Never invented: null until a lawyer supplies the article number.
    // Article number, optionally with paragraphs/points as quoted in the Code, e.g. "92", "95(2.1)", "109(1)(2)".
    article: z.string().regex(/^\d+(\.\d+)?(\(\d+(\.\d+)?\))*$/).nullable(),
    status: z.enum(["verified", "needs_lawyer_review"]),
    /** Date a lawyer last reviewed this rule against arlis.am (YYYY-MM-DD). null = not yet reviewed by a lawyer. */
    reviewed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    source_url: z.string().url().startsWith("https://www.arlis.am/"),
    source_note: z.string(),
    basis: z.string(),
    scope: z.enum(["contract", "employee"]),
    severity: z.enum(["red", "amber", "info"]),
    title: localized,
    conditions: z.record(z.string(), z.unknown()),
    due: z.object({
      date: z.enum(DATE_ANCHORS),
      offsetDays: z.number().int(),
      /** "working" counts offsetDays in working days (weekends and public holidays skipped). Default: calendar days. */
      unit: z.enum(["calendar", "working"]).optional(),
      /** true moves a due date that falls on a weekend or holiday to the next working day. Default: stays as is. */
      moveToWorkingDay: z.boolean().optional(),
    }),
    edge_cases: z.array(z.string()),
  })
  .refine((r) => r.status !== "verified" || r.article !== null, {
    message: "A verified rule must cite an article",
  });

export type RuleDefinition = z.infer<typeof ruleSchema>;
