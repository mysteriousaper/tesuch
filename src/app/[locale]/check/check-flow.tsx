"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { ScoreGauge } from "@/components/score-gauge";
import { IconArrow, IconCheck } from "@/components/landing/icons";
import { submitLead, type LeadResult } from "./actions";
import { band, scoreAnswers, verdict, type Answer, type CheckQuestion } from "./questions";

export interface FlowQuestion extends CheckQuestion {
  article: string | null;
  sourceUrl: string;
}

const ANSWERS: Answer[] = ["yes", "no", "unsure"];

export function CheckFlow({ questions }: { questions: FlowQuestion[] }) {
  const t = useTranslations("check");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const done = step >= questions.length;

  // Move focus to the new question / result heading so screen readers announce it — but not on first load.
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  function choose(id: string, a: Answer) {
    setAnswers((prev) => ({ ...prev, [id]: a }));
    setStep((s) => s + 1);
  }

  if (done) {
    return (
      <Result
        questions={questions}
        answers={answers}
        headingRef={headingRef}
        onRestart={() => {
          setAnswers({});
          setStep(0);
        }}
      />
    );
  }

  const q = questions[step];
  const progress = Math.round((step / questions.length) * 100);
  return (
    <div className="glass p-5 shadow-[0_30px_70px_-40px_color-mix(in_oklab,var(--ink)_40%,transparent)] sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-4 text-sm text-muted">
        <span aria-live="polite">{t("progress", { n: step + 1, total: questions.length })}</span>
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="rounded-theme px-2 py-1 underline-offset-4 hover:text-ink hover:underline">
            ← {t("back")}
          </button>
        )}
      </div>
      <div
        className="mb-8 h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={step}
        aria-label={t("progress", { n: step + 1, total: questions.length })}
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>
      <h2 ref={headingRef} tabIndex={-1} className="mb-8 min-h-[3.5em] text-xl font-semibold leading-snug outline-none sm:text-2xl">
        {t(`questions.${q.id}.q`)}
      </h2>
      <div role="group" aria-label={t(`questions.${q.id}.q`)} className="grid gap-3 sm:grid-cols-3">
        {ANSWERS.map((a) => {
          const selected = answers[q.id] === a;
          return (
            <button
              key={a}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(q.id, a)}
              className={`rounded-theme border px-4 py-4 text-base font-semibold transition-all hover:-translate-y-0.5 hover:border-accent ${
                selected ? "border-accent bg-accent text-accent-ink" : "border-control bg-bg"
              }`}
            >
              {t(`answers.${a}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Result({
  questions, answers, headingRef, onRestart,
}: {
  questions: FlowQuestion[];
  answers: Record<string, Answer>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onRestart: () => void;
}) {
  const t = useTranslations("check");
  const score = scoreAnswers(answers, questions);
  const b = band(score);
  const issues = questions.filter((q) => verdict(q, answers[q.id]) !== "good");
  const ok = questions.filter((q) => verdict(q, answers[q.id]) === "good");

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="result-title" className="glass p-5 sm:p-8">
        <h2 id="result-title" ref={headingRef} tabIndex={-1} className="mb-6 text-2xl font-bold outline-none">{t("result.title")}</h2>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <ScoreGauge value={score} label={t("result.scoreLabel")} size={200} />
          <div className="text-center sm:text-left">
            <p className="text-xl font-semibold" style={{ color: b === "good" ? "var(--ok)" : b === "mid" ? "var(--warn)" : "var(--danger)" }}>
              {t(`result.bands.${b}.t`)}
            </p>
            <p className="mt-2 max-w-md leading-relaxed text-muted">{t(`result.bands.${b}.d`)}</p>
          </div>
        </div>
      </section>

      {issues.length > 0 && (
        <section aria-labelledby="issues-title" className="glass p-5 sm:p-8">
          <h3 id="issues-title" className="mb-4 text-lg font-semibold">{t("result.issuesTitle")}</h3>
          <ul className="flex flex-col gap-3">
            {issues.map((q) => {
              const v = verdict(q, answers[q.id]);
              return (
                <li key={q.id} className="flex flex-col gap-2 rounded-theme border border-line bg-bg p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-advisory px-2 py-0.5 font-semibold text-advisory">{t("result.advisory")}</span>
                    <span className="text-muted">{q.article ? t("result.article", { n: q.article }) : t("result.articlePending")}</span>
                  </div>
                  <p className="font-medium">{t(`questions.${q.id}.why`)}</p>
                  <p className="text-sm text-muted">
                    {t("result.yourAnswer", { answer: t(`answers.${answers[q.id] ?? "unsure"}`) })}
                    {v === "unsure" && <> · {t("result.unsureNote")}</>}
                  </p>
                  <a href={q.sourceUrl} target="_blank" rel="noopener noreferrer" className="w-fit text-sm text-highlight underline-offset-4 hover:underline">
                    {t("result.source")} ↗
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ok.length > 0 && (
        <details className="glass p-5 sm:px-8">
          <summary className="cursor-pointer font-semibold">
            {t("result.okTitle")} · {ok.length}/{questions.length}
          </summary>
          <ul className="mt-4 flex flex-col gap-2">
            {ok.map((q) => (
              <li key={q.id} className="flex items-start gap-2 text-sm">
                <IconCheck width={16} height={16} className="mt-0.5 shrink-0 text-ok" />
                <span>{t(`questions.${q.id}.q`)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <LeadForm answers={answers} />

      <div className="flex flex-col gap-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl">ⓘ {t("result.disclaimer")}</p>
        <button type="button" onClick={onRestart} className="shrink-0 rounded-full border border-control px-4 py-2 font-medium text-ink hover:bg-surface-2">
          {t("result.restart")}
        </button>
      </div>
    </div>
  );
}

function LeadForm({ answers }: { answers: Record<string, Answer> }) {
  const t = useTranslations("check.lead");
  const locale = useLocale() as "hy" | "ru" | "en";
  const [result, setResult] = useState<LeadResult | null>(null);
  const [pending, start] = useTransition();

  if (result?.ok) {
    return (
      <p role="status" className="flex items-center gap-3 rounded-theme-lg border border-ok bg-surface p-5 font-medium text-ok">
        <IconCheck /> {t("success")}
      </p>
    );
  }

  const input = "w-full rounded-full border border-control bg-bg px-3 py-2.5 text-base";
  return (
    <section aria-labelledby="lead-title" className="glass p-5 sm:p-8">
      <h3 id="lead-title" className="text-lg font-semibold">{t("title")}</h3>
      <p className="mb-5 mt-1 text-muted">{t("desc")}</p>
      <form
        className="grid gap-4 sm:grid-cols-2"
        action={(f) =>
          start(async () => {
            setResult(
              await submitLead({
                email: String(f.get("email") ?? ""),
                locale,
                answers,
                companySize: (f.get("size") as never) || null,
                role: (f.get("role") as never) || null,
                consent: f.get("consent") === "on" ? true : (false as never),
                website: String(f.get("website") ?? ""),
              }),
            );
          })
        }
      >
        {/* Honeypot: invisible to people and assistive tech, bots fill it. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="lead-email" className="text-sm font-medium">{t("email")}</label>
          <input id="lead-email" name="email" type="email" required autoComplete="email" maxLength={254} className={input} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lead-size" className="text-sm font-medium">{t("size")}</label>
          <select id="lead-size" name="size" className={input} defaultValue="">
            <option value="">—</option>
            {(["firm", "1-9", "10-49", "50-99", "100+"] as const).map((s) => <option key={s} value={s}>{t(`sizes.${s}`)}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lead-role" className="text-sm font-medium">{t("role")}</label>
          <select id="lead-role" name="role" className={input} defaultValue="">
            <option value="">—</option>
            {(["owner", "hr", "accountant_firm", "other"] as const).map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
          </select>
        </div>
        <label className="flex items-start gap-3 text-sm leading-relaxed sm:col-span-2">
          <input name="consent" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
          <span>{t("consent")}</span>
        </label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 font-semibold text-accent-ink disabled:opacity-60">
            {pending ? t("sending") : t("submit")}
            {!pending && <IconArrow width={18} height={18} />}
          </button>
          {result && !result.ok && (
            <p role="alert" className="text-sm text-danger">{t(result.reason === "throttled" ? "throttled" : result.reason === "invalid" ? "invalid" : "error")}</p>
          )}
        </div>
      </form>
    </section>
  );
}
