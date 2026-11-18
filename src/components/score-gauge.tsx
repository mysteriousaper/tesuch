"use client";

import { useEffect, useState } from "react";

/** Semicircle 0–100 gauge. Colour follows score band; the number is always shown, so colour is never the only signal. */
export function ScoreGauge({ value, label, size = 180 }: { value: number; label: string; size?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(Math.max(0, Math.min(100, value))));
    return () => cancelAnimationFrame(id);
  }, [value]);

  const r = 80;
  const arc = Math.PI * r;
  const tone = value >= 80 ? "var(--ok)" : value >= 50 ? "var(--warn)" : "var(--danger)";

  return (
    <figure className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 200 112" width={size} height={size * 0.56} role="img" aria-label={`${label}: ${value}/100`}>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--surface-2)" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={tone}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={arc}
          strokeDashoffset={arc * (1 - shown / 100)}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)" }}
        />
        <text x="100" y="92" textAnchor="middle" fontSize="40" fontWeight="700" fill="var(--ink)">
          {value}
        </text>
      </svg>
      <figcaption className="mt-1 text-center text-sm text-muted">{label}</figcaption>
    </figure>
  );
}
