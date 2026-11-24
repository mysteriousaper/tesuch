import { getTranslations, setRequestLocale } from "next-intl/server";
import { CompanyPicker } from "@/components/documents/company-picker";
import { yerevanToday } from "@/components/documents/yerevan-date";
import { QuizForm } from "@/components/quiz/quiz-form";
import { StreakPanel } from "@/components/quiz/streak-panel";
import { citation, ruleById } from "@/lib/notify/i18n";
import { currentStreak, earnedBadges, isoWeekOf, longestStreak, pickWeeklyQuestions, scoreQuiz } from "@/lib/quiz/quiz";
import { supabaseForUser } from "@/lib/supabase/server";
import { buildWeekRecords, weekKey, type AttemptRow, type FindingHistoryRow } from "./streak";

export const dynamic = "force-dynamic";

type Loc = "hy" | "ru" | "en";

export default async function QuizPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ company?: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = raw as Loc;
  const { company: requested } = await searchParams;
  const t = await getTranslations("quiz");
  const db = await supabaseForUser();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null; // layout redirects

  const { data: companies } = await db.from("companies").select("id, name, org_id").order("name");
  if (!companies?.length) {
    return (
      <section className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="rounded-theme-lg border border-dashed border-line bg-surface p-6 text-muted">{t("noCompanies")}</p>
      </section>
    );
  }
  const company = companies.find((c) => c.id === requested) ?? companies[0];

  const today = yerevanToday();
  const week = isoWeekOf(today);
  const key = weekKey(week);
  const questions = pickWeeklyQuestions(company.id, week);

  const [{ data: membership }, { data: attempts }, { data: findings }] = await Promise.all([
    db.from("memberships").select("role").eq("org_id", company.org_id).eq("user_id", user.id).maybeSingle(),
    db.from("quiz_attempts").select("iso_week, score, answers").eq("company_id", company.id).eq("user_id", user.id),
    db.from("findings").select("severity, due_date, first_seen_at, resolved_at").eq("company_id", company.id),
  ]);
  const canTake = membership?.role === "owner" || membership?.role === "accountant";
  const thisWeek = attempts?.find((a) => a.iso_week === key);

  const records = buildWeekRecords((attempts ?? []) as AttemptRow[], (findings ?? []) as FindingHistoryRow[], today);
  const current = currentStreak(records, week);
  const longest = longestStreak(records);

  let body: React.ReactNode;
  if (thisWeek) {
    const stored = thisWeek.answers as { questionId: string; chosen: number | null }[];
    const chosenById = new Map(stored.map((a) => [a.questionId, a.chosen]));
    const result = scoreQuiz(questions, questions.map((q) => chosenById.get(q.id) ?? null));
    body = (
      <div className="flex flex-col gap-4">
        <p role="status" className="glass p-4">
          <span className="text-2xl font-bold">{t("result", { correct: result.correct, total: result.total })}</span>
          <span className="mt-1 block text-sm text-muted">{t("alreadyTaken")}</span>
        </p>
        <ol className="flex flex-col gap-3">
          {questions.map((q, i) => {
            const a = result.answers[i];
            const rule = ruleById(q.ruleId);
            return (
              <li key={q.id} className="glass p-4">
                <p className="flex items-start gap-2 font-medium">
                  <span aria-hidden>{a.correct ? "✅" : "❌"}</span>
                  <span>
                    <span className="sr-only">{a.correct ? t("correct") : t("wrong")}: </span>
                    {q.prompt[locale]}
                  </span>
                </p>
                {!a.correct && a.chosen !== null && (
                  <p className="mt-2 text-sm text-danger">{t("yourAnswer")}: {q.options[a.chosen]?.[locale]}</p>
                )}
                <p className="mt-1 text-sm text-ok">{t("rightAnswer")}: {q.options[q.correct][locale]}</p>
                <p className="mt-2 text-sm text-muted">{q.explanation[locale]}</p>
                <p className="mt-2 text-xs text-muted">
                  {t("source")}:{" "}
                  <a href={rule.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                    {citation(rule, locale)}
                  </a>
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    );
  } else if (canTake) {
    body = (
      <QuizForm
        locale={locale}
        companyId={company.id}
        week={key}
        questions={questions.map((q) => ({ id: q.id, prompt: q.prompt[locale], options: q.options.map((o) => o[locale]) }))}
      />
    );
  } else {
    body = <p className="rounded-theme-lg border border-dashed border-line bg-surface p-6 text-muted">{t("viewerNote")}</p>;
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="glass flex flex-col gap-2 px-5 py-4" data-glass-enter>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">
          {t("intro")} · <span className="font-medium text-ink">{t("week", { year: week.year, week: week.week })}</span>
        </p>
      </header>
      {companies.length > 1 && <CompanyPicker companies={companies} selected={company.id} label={t("company")} submit={t("choose")} />}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>{body}</div>
        <StreakPanel
          locale={locale}
          earned={earnedBadges(records)}
          labels={{
            streak: t("streak"),
            longest: t("longest"),
            currentWeeks: t("weeks", { count: current }),
            longestWeeks: t("weeks", { count: longest }),
            badges: t("badges"),
            noBadges: t("noBadges"),
            rule: t("streakRule"),
          }}
        />
      </div>
      <p className="text-xs text-muted">ⓘ {t("disclaimer")}</p>
    </section>
  );
}
