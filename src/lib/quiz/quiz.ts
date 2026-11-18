// Weekly quiz selection and scoring, streaks and badges. Pure and deterministic.
import { addWeeks, differenceInCalendarDays, getISOWeek, getISOWeekYear, parseISO, setISOWeek, startOfISOWeek, startOfISOWeekYear } from "date-fns";
import { ruleById } from "../notify/i18n";
import type { RuleStatus } from "../rules/types";
import { QUESTIONS, type L, type QuizQuestionDef } from "./questions";

export interface QuizQuestion extends QuizQuestionDef {
  /** Taken from the rule, so the UI can show the same "pending lawyer review" marker as findings. */
  ruleStatus: RuleStatus;
  article: string | null;
}

export interface IsoWeek {
  year: number;
  week: number;
}

export const QUESTIONS_PER_WEEK = 5;

export function withRuleInfo(q: QuizQuestionDef): QuizQuestion {
  const rule = ruleById(q.ruleId);
  return { ...q, ruleStatus: rule.status, article: rule.article };
}

export function isoWeekOf(isoDate: string): IsoWeek {
  const d = parseISO(isoDate);
  return { year: getISOWeekYear(d), week: getISOWeek(d) };
}

/** Monday of the ISO week. */
function mondayOf(w: IsoWeek): Date {
  return startOfISOWeek(setISOWeek(startOfISOWeekYear(new Date(w.year, 0, 4)), w.week));
}

/** Monotonic week number, so consecutive weeks differ by exactly 1 across year boundaries (incl. week 53). */
export function weekIndex(w: IsoWeek): number {
  return Math.round(differenceInCalendarDays(mondayOf(w), new Date(1970, 0, 5)) / 7);
}

export function nextWeek(w: IsoWeek): IsoWeek {
  const d = addWeeks(mondayOf(w), 1);
  return { year: getISOWeekYear(d), week: getISOWeek(d) };
}

// FNV-1a hash → mulberry32 PRNG: tiny, stable across runtimes.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same company + same ISO week → same questions; different weeks or companies get different picks. */
export function pickWeeklyQuestions(companyId: string, week: IsoWeek, count = QUESTIONS_PER_WEEK, pool: QuizQuestionDef[] = QUESTIONS): QuizQuestion[] {
  const rand = rng(hash(`${companyId}:${week.year}-W${week.week}`));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, pool.length)).map(withRuleInfo);
}

export interface QuizResult {
  correct: number;
  total: number;
  percent: number;
  answers: { questionId: string; chosen: number | null; correct: boolean; explanation: L }[];
}

/** Unanswered questions (null/undefined) count as wrong. */
export function scoreQuiz(questions: QuizQuestionDef[], chosen: (number | null | undefined)[]): QuizResult {
  const answers = questions.map((q, i) => {
    const c = chosen[i] ?? null;
    return { questionId: q.id, chosen: c, correct: c === q.correct, explanation: q.explanation };
  });
  const correct = answers.filter((a) => a.correct).length;
  return { correct, total: questions.length, percent: questions.length ? Math.round((correct / questions.length) * 100) : 0, answers };
}

// ---------- Streaks and badges ----------

export interface WeekRecord extends IsoWeek {
  /** No open red/advisory findings that were overdue at the end of the week. */
  clean: boolean;
  quizTaken: boolean;
  quizPercent?: number;
}

/** A finding counts against a clean week if it is open, overdue and red or advisory. */
export function isCleanWeek(findings: { status: string; severity: string; overdue: boolean }[]): boolean {
  return !findings.some((f) => f.status === "open" && f.overdue && (f.severity === "red" || f.severity === "advisory"));
}

const qualifies = (r: WeekRecord) => r.clean && r.quizTaken;

/** Lengths of runs of consecutive qualifying weeks, oldest first. */
function runs(records: WeekRecord[]): { length: number; lastIndex: number }[] {
  const idx = [...new Set(records.filter(qualifies).map(weekIndex))].sort((a, b) => a - b);
  const out: { length: number; lastIndex: number }[] = [];
  for (const i of idx) {
    const last = out.at(-1);
    if (last && i === last.lastIndex + 1) {
      last.length++;
      last.lastIndex = i;
    } else out.push({ length: 1, lastIndex: i });
  }
  return out;
}

/**
 * Current streak: consecutive qualifying weeks ending at `current`, or at the week before it
 * (the current week is still in progress, so not having finished it yet does not break the streak).
 */
export function currentStreak(records: WeekRecord[], current: IsoWeek): number {
  const now = weekIndex(current);
  const last = runs(records).at(-1);
  return last && (last.lastIndex === now || last.lastIndex === now - 1) ? last.length : 0;
}

export function longestStreak(records: WeekRecord[]): number {
  return Math.max(0, ...runs(records).map((r) => r.length));
}

export type BadgeId = "first_clean_week" | "streak_4" | "streak_12" | "quiz_ace";

export const BADGES: Record<BadgeId, { title: L; description: L }> = {
  first_clean_week: {
    title: { hy: "Առաջին մաքուր շաբաթ", ru: "Первая чистая неделя", en: "First clean week" },
    description: { hy: "Մեկ շաբաթ առանց ժամկետանց խախտումների", ru: "Неделя без просроченных нарушений", en: "A week with no overdue violations" },
  },
  streak_4: {
    title: { hy: "Ամսվա պատրաստվածություն", ru: "Месяц готовности", en: "Inspection-ready month" },
    description: { hy: "4 շաբաթ անընդմեջ մաքուր և վիկտորինայով", ru: "4 недели подряд чисто и с викториной", en: "4 weeks in a row clean, quiz done" },
  },
  streak_12: {
    title: { hy: "Եռամսյակի չեմպիոն", ru: "Чемпион квартала", en: "Quarter champion" },
    description: { hy: "12 շաբաթ անընդմեջ մաքուր և վիկտորինայով", ru: "12 недель подряд чисто и с викториной", en: "12 weeks in a row clean, quiz done" },
  },
  quiz_ace: {
    title: { hy: "Անսխալ տեսուչ", ru: "Безошибочный инспектор", en: "Quiz ace" },
    description: { hy: "Վիկտորինայի բոլոր պատասխանները ճիշտ են", ru: "Все ответы викторины верны", en: "Every quiz answer correct" },
  },
};

/** Badges are permanent once earned, so they use the longest streak, not the current one. */
export function earnedBadges(records: WeekRecord[]): BadgeId[] {
  const longest = longestStreak(records);
  const out: BadgeId[] = [];
  if (records.some((r) => r.clean)) out.push("first_clean_week");
  if (longest >= 4) out.push("streak_4");
  if (longest >= 12) out.push("streak_12");
  if (records.some((r) => r.quizTaken && r.quizPercent === 100)) out.push("quiz_ace");
  return out;
}
