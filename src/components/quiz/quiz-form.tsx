"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { submitQuiz } from "@/app/[locale]/app/quiz/actions";

/** Questions as shown to the client: prompt and options only. The correct answers never leave the server. */
export interface ClientQuestion {
  id: string;
  prompt: string;
  options: string[];
}

export function QuizForm({ locale, companyId, week, questions }: { locale: "hy" | "ru" | "en"; companyId: string; week: string; questions: ClientQuestion[] }) {
  const t = useTranslations("quiz");
  const router = useRouter();
  const [chosen, setChosen] = useState<(number | null)[]>(() => questions.map(() => null));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Until hydration the submit handler is not attached; a native submit would skip validation.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (chosen.some((c) => c === null)) return setError(t("unanswered"));
    setError(null);
    start(async () => {
      const r = await submitQuiz({ locale, companyId, week, chosen });
      if (r.ok || r.error === "already") return router.refresh();
      setError(r.error === "stale" ? t("stale") : r.error === "unanswered" ? t("unanswered") : t("error"));
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {questions.map((q, qi) => (
        <fieldset key={q.id} className="rounded-theme-lg border border-line bg-surface p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {t("question", { n: qi + 1, total: questions.length })}
          </legend>
          <p className="mb-3 font-medium">{q.prompt}</p>
          <div className="flex flex-col gap-2">
            {q.options.map((opt, oi) => (
              <label
                key={oi}
                className={`flex cursor-pointer items-start gap-3 rounded-theme border px-3 py-2.5 text-sm ${
                  chosen[qi] === oi ? "border-accent bg-surface-2" : "border-line hover:bg-surface-2"
                }`}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={oi}
                  checked={chosen[qi] === oi}
                  onChange={() => setChosen((c) => c.map((v, i) => (i === qi ? oi : v)))}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button disabled={pending || !ready} className="self-start rounded-theme bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-60">
        {t("submit")}
      </button>
    </form>
  );
}
