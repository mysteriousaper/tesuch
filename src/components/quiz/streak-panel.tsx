import { BADGES, type BadgeId } from "@/lib/quiz/quiz";

const ALL: BadgeId[] = ["first_clean_week", "streak_4", "streak_12", "quiz_ace"];
const ICON: Record<BadgeId, string> = { first_clean_week: "🌱", streak_4: "🔥", streak_12: "🏆", quiz_ace: "🎯" };

export function StreakPanel({
  locale, earned, labels,
}: {
  locale: "hy" | "ru" | "en";
  earned: BadgeId[];
  labels: { streak: string; longest: string; currentWeeks: string; longestWeeks: string; badges: string; noBadges: string; rule: string };
}) {
  return (
    <aside className="flex flex-col gap-4 glass p-4" aria-label={labels.streak}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-theme bg-surface-2 p-3">
          <p className="text-xs text-muted">{labels.streak}</p>
          <p className="text-2xl font-bold"><span aria-hidden="true">🔥</span> {labels.currentWeeks}</p>
        </div>
        <div className="rounded-theme bg-surface-2 p-3">
          <p className="text-xs text-muted">{labels.longest}</p>
          <p className="text-2xl font-bold">{labels.longestWeeks}</p>
        </div>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold">{labels.badges}</h2>
        {earned.length === 0 && <p className="mb-2 text-sm text-muted">{labels.noBadges}</p>}
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {ALL.map((id) => {
            const has = earned.includes(id);
            return (
              <li
                key={id}
                className={`flex min-w-0 flex-col gap-0.5 rounded-theme border p-2.5 [overflow-wrap:anywhere] [hyphens:auto] ${has ? "border-ok" : "border-line border-dashed"}`}
                aria-label={`${BADGES[id].title[locale]}${has ? " ✓" : ""}`}
              >
                <span className={`text-lg${has ? "" : " grayscale"}`} aria-hidden>{ICON[id]}</span>
                <span className="text-sm font-semibold">{BADGES[id].title[locale]}</span>
                <span className="text-xs text-muted">{BADGES[id].description[locale]}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-xs text-muted">{labels.rule}</p>
    </aside>
  );
}
