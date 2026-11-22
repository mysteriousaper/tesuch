// "Tesuch checks N areas" with the list of rules, and the line that this is not a guarantee.
// Presentational only: callers pass translated strings, so it works in server and client components.
export function CoverageNote({ titles, summary, listLabel, note, reviewed }: { titles: string[]; summary: string; listLabel: string; note: string; /** "Rules last reviewed: <date>" or the not-yet-reviewed line. */ reviewed: string }) {
  return (
    <div className="rounded-theme-lg border border-line bg-surface p-4 text-sm" data-testid="coverage-note">
      <details>
        <summary className="min-h-11 cursor-pointer py-2 font-medium" data-testid="coverage-summary">{summary}</summary>
        <p className="mt-1 font-semibold">{listLabel}</p>
        <ul className="mt-2 list-disc pl-5 text-muted">
          {titles.map((title, i) => <li key={i}>{title}</li>)}
        </ul>
        <p className="mt-2 text-muted" data-testid="rules-reviewed">{reviewed}</p>
      </details>
      <p className="mt-1 text-muted" data-testid="coverage-disclaimer">{note}</p>
    </div>
  );
}
