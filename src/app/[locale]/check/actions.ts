"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
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
  /** Honeypot: hidden in the form, so only a bot fills it. */
  website: z.string().max(200).optional(),
});

export type LeadInput = z.input<typeof leadSchema>;
export type LeadResult = { ok: true } | { ok: false; reason: "invalid" | "throttled" | "error" };

/**
 * Stores a lead through the submit_lead RPC. Only the service role may execute that function
 * (anon/authenticated were revoked), so the public anon key can't be used to flood leads; the RPC's
 * global hourly cap and per-email throttle protect this action as well. The score is recomputed
 * here from the answers — the client's number is never trusted.
 */
/** HMAC of the caller's IP, keyed with a server secret: lets the database throttle per visitor without storing the address. */
async function visitorHash(): Promise<string | null> {
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
    return key && ip ? createHmac("sha256", key).update(ip).digest("hex") : null;
  } catch {
    return null; // outside a request (tests) or no header
  }
}

export async function submitLead(input: LeadInput): Promise<LeadResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const d = parsed.data;
  // Honeypot: pretend it worked, store nothing.
  if (d.website?.trim()) return { ok: true };

  let db: ReturnType<typeof supabaseService>;
  try {
    db = supabaseService();
  } catch {
    return { ok: false, reason: "error" }; // server keys not configured
  }

  const args = {
    p_email: d.email,
    p_locale: d.locale,
    p_score: scoreAnswers(d.answers),
    p_answers: d.answers,
    p_company_size: d.companySize,
    p_role: d.role,
    p_consent: d.consent,
  };
  let { error } = await db.rpc("submit_lead", { ...args, p_ip_hash: await visitorHash() });
  // Deploy order safety: before the 20261125030000 migration is applied the function has no p_ip_hash argument (PGRST202).
  if (error?.code === "PGRST202") ({ error } = await db.rpc("submit_lead", args));
  if (!error) return { ok: true };
  if (error.code === "P0429") return { ok: false, reason: "throttled" };
  if (error.code === "22023") return { ok: false, reason: "invalid" };
  return { ok: false, reason: "error" };
}
