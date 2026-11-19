"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { yerevanToday } from "@/components/documents/yerevan-date";
import { isoWeekOf, pickWeeklyQuestions, scoreQuiz } from "@/lib/quiz/quiz";
import { supabaseForUser, supabaseService } from "@/lib/supabase/server";
import { weekKey } from "./streak";

export type SubmitResult = { ok: true } | { ok: false; error: "invalid" | "unanswered" | "stale" | "forbidden" | "already" | "error" };

const input = z.object({
  locale: z.enum(["hy", "ru", "en"]),
  companyId: z.string().uuid(),
  week: z.string().regex(/^\d{4}-W\d{2}$/),
  chosen: z.array(z.number().int().min(0).max(9).nullable()).max(20),
});

/**
 * Scores on the server from the server's own question pick; the client only sends option indexes.
 * Writes with the service role because users have no insert grant on quiz_attempts (no forged scores).
 */
export async function submitQuiz(raw: unknown): Promise<SubmitResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { locale, companyId, week, chosen } = parsed.data;

  const db = await supabaseForUser();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: "forbidden" };

  // RLS: the company is only visible to members of its org.
  const { data: company } = await db.from("companies").select("id, org_id").eq("id", companyId).maybeSingle();
  if (!company) return { ok: false, error: "forbidden" };
  const { data: membership } = await db.from("memberships").select("role").eq("org_id", company.org_id).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "accountant"].includes(membership.role)) return { ok: false, error: "forbidden" };

  // Same Armenia date as the quiz page, so the week never differs between render and submit.
  const current = isoWeekOf(yerevanToday());
  if (weekKey(current) !== week) return { ok: false, error: "stale" };

  const questions = pickWeeklyQuestions(companyId, current);
  if (chosen.length !== questions.length || chosen.some((c, i) => c === null || c >= questions[i].options.length)) {
    return { ok: false, error: "unanswered" };
  }
  const result = scoreQuiz(questions, chosen);

  const { error } = await supabaseService().from("quiz_attempts").insert({
    org_id: company.org_id,
    company_id: company.id,
    user_id: user.id,
    iso_week: week,
    answers: result.answers.map((a) => ({ questionId: a.questionId, chosen: a.chosen })),
    score: result.percent,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "already" };
    console.error("quiz_attempts insert failed", error.code, error.message);
    return { ok: false, error: "error" };
  }

  revalidatePath(`/${locale}/app/quiz`);
  return { ok: true };
}
