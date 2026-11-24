import { getTranslations } from "next-intl/server";
import { connectTelegram } from "@/app/[locale]/app/notify-actions";
import { Link } from "@/i18n/navigation";

type StepState = "done" | "now" | "next";

/**
 * Three plain steps for a new business: add staff, check and confirm, connect Telegram.
 * Steps 1 and 2 are one trip through the import wizard (it previews before it saves). State is shown in words, not only colour.
 */
export async function OnboardingSteps({ staffAdded, telegramLinked, assisted }: { staffAdded: boolean; telegramLinked: boolean; assisted: React.ReactNode }) {
  const t = await getTranslations("owner");
  const state = (n: 1 | 2 | 3): StepState => {
    if (n === 3) return telegramLinked ? "done" : staffAdded ? "now" : "next";
    return staffAdded ? "done" : n === 1 ? "now" : "next";
  };
  const label = (s: StepState) => (s === "done" ? t("onboard.skip") : s === "now" ? t("onboard.now") : t("onboard.next"));
  const badge = (s: StepState) =>
    `rounded-full px-2 py-0.5 text-xs font-semibold ${s === "done" ? "bg-ok/15 text-ok" : s === "now" ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"}`;
  const btn = "inline-flex min-h-11 items-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink";
  const steps = [1, 2, 3] as const;
  return (
    <section className="flex flex-col gap-4 glass p-4" aria-labelledby="onboard-h" data-testid="onboarding-steps">
      <h2 id="onboard-h" className="text-lg font-semibold">{t("onboard.title")}</h2>
      <ol className="flex flex-col gap-4">
        {steps.map((n) => {
          const s = state(n);
          const k = `onboard.s${n}` as const;
          return (
            <li key={n} className="flex gap-3" data-step={n} data-state={s}>
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold">{s === "done" ? "✓" : n}</span>
              <div className="flex min-w-0 flex-col gap-2">
                <p className="flex flex-wrap items-center gap-2 font-semibold">{t(`${k}.title`)} <span className={badge(s)}>{label(s)}</span></p>
                <p className="text-sm text-muted">{t(`${k}.body`)}</p>
                {n === 1 && !staffAdded && <Link href="/app/import" className={btn}>{t("onboard.s1.upload")}</Link>}
                {n === 1 && !staffAdded && assisted}
                {n === 3 && !telegramLinked && (
                  <form action={connectTelegram}><button type="submit" className={btn}>{t("onboard.s3.connect")}</button></form>
                )}
                {n === 3 && telegramLinked && <p className="text-sm font-medium text-ok">{t("onboard.s3.connected")}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
