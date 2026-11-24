/** Reference capacity meter. Exposes role="meter" with the numbers. */
export function GlassMeter({ value, max, label }: { value: number; max: number; label: string; tone?: "ok" | "warn" | "danger"; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="gd-capacity-track" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span className="gd-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
