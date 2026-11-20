export type Item = { t: string; d: string };

/** A grid of short titled cards (used for facts and limits on the security page). */
export function Cards({ items }: { items: Item[] }) {
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {items.map((i) => (
        <li key={i.t} className="rounded-theme-lg border border-line bg-surface p-4">
          <h3 className="font-semibold">{i.t}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{i.d}</p>
        </li>
      ))}
    </ul>
  );
}
