"use server";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CHECK_QUESTIONS } from "./questions";

const questionIds = CHECK_QUESTIONS.map((q) => q.id) as [string, ...string[]];

const leadSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  locale: z.enum(["hy", "ru", "en"]),
  score: z.number().int().min(0).max(100),
  answers: z.partialRecord(z.enum(questionIds), z.enum(["yes", "no", "unsure"])),
  companySize: z.enum(["firm", "1-9", "10-49", "50-99", "100+"]).nullable(),
  role: z.enum(["owner", "hr", "accountant_firm", "other"]).nullable(),
  consent: z.literal(true),
});

export type LeadInput = z.input<typeof leadSchema>;
export type LeadResult = { ok: true } | { ok: false; reason: "invalid" | "throttled" | "error" };

/** Stores a lead through the submit_lead RPC (anon key, no session). The table itself is unreadable via the API. */
export async function submitLead(input: LeadInput): Promise<LeadResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, reason: "error" };

  const d = parsed.data;
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.rpc("submit_lead", {
    p_email: d.email,
    p_locale: d.locale,
    p_score: d.score,
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
