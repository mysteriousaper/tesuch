import { z } from "zod";

const localized = z.object({ hy: z.string().min(1), ru: z.string().min(1), en: z.string().min(1) });

export const DATE_ANCHORS = ["asOf", "probationEnd", "contractEnd"] as const;

export const ruleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.number().int().positive(),
    // Never invented: null until a lawyer supplies the article number.
    article: z.string().regex(/^\d+(\.\d+)?$/).nullable(),
    status: z.enum(["verified", "needs_lawyer_review"]),
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
