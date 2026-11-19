"use server";

import { z } from "zod";
import { supabaseService } from "@/lib/supabase/server";
import { CHECK_QUESTIONS, scoreAnswers } from "./questions";

const questionIds = CHECK_QUESTIONS.map((q) => q.id) as [string, ...string[]];

const leadSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  locale: z.enum(["hy", "ru", "en"]),
  answers: z.partialRecord(z.enum(questionIds), z.enum(["yes", "no", "unsure"])),
  companySize: z.enum(["firm", "1-9", "10-49", "50-99", "100+"]).nullable(),
  role: z.enum(["owner", "hr", "accountant_firm", "other"]).nullable(),
  consent: z.literal(true),
});

export type LeadInput = z.input<typeof leadSchema>;
export type LeadResult = { ok: true } | { ok: false; reason: "invalid" | "throttled" | "error" };

/**
 * Stores a lead through the submit_lead RPC. Only the service role may execute that function
 * (anon/authenticated were revoked), so the public anon key can't be used to flood leads; the RPC's
 * global hourly cap and per-email throttle protect this action as well. The score is recomputed
 * here from the answers — the client's number is never trusted.
 */
export async function submitLead(input: LeadInput): Promise<LeadResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const d = parsed.data;

  let db: ReturnType<typeof supabaseService>;
  try {
    db = supabaseService();
  } catch {
    return { ok: false, reason: "error" }; // server keys not configured
  }

  const { error } = await db.rpc("submit_lead", {
    p_email: d.email,
    p_locale: d.locale,
    p_score: scoreAnswers(d.answers),
    p_answers: d.answers,
    p_company_size: d.companySize,
    p_role: d.role,
    p_consent: d.consent,
  });
  if (!error) return { ok: true };
  if (error.code === "P0429") return { ok: false, reason: "throttled" };
  if (error.code === "22023") return { ok: false, reason: "invalid" };
  return { ok: false, reason: "error" };
}
