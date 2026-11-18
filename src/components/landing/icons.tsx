// Inline line icons (24px grid, currentColor). Hand-drawn paths, no icon package needed.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const LogoMark = (p: P) => (
  <svg {...base} viewBox="0 0 32 32" strokeWidth={2.4} {...p}>
    <rect x="2" y="2" width="28" height="28" rx="8" fill="var(--accent)" stroke="none" />
    <path d="M9 20a7 7 0 0 1 14 0" stroke="var(--accent-ink)" />
    <path d="M16 20l3.5-4.5" stroke="var(--accent-ink)" />
    <circle cx="16" cy="20" r="1.4" fill="var(--accent-ink)" stroke="none" />
  </svg>
);

export const IconUpload = (p: P) => (
  <svg {...base} {...p}><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /><path d="M12 4v11" /><path d="M7.5 8.5 12 4l4.5 4.5" /></svg>
);
export const IconMoon = (p: P) => (
  <svg {...base} {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /><path d="M15 3.5v2M14 4.5h2M19 8v1.6M18.2 8.8h1.6" /></svg>
);
export const IconBell = (p: P) => (
  <svg {...base} {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>
);
export const IconCheckDoc = (p: P) => (
  <svg {...base} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /><path d="m9 14 2 2 4-4" /></svg>
);
export const IconCode = (p: P) => (
  <svg {...base} {...p}><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" /></svg>
);
export const IconScale = (p: P) => (
  <svg {...base} {...p}><path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0Zm14 0-2.5 6a3 3 0 0 0 5 0Z" /><circle cx="12" cy="4" r="1" /></svg>
);
export const IconShieldCheck = (p: P) => (
  <svg {...base} {...p}><path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6Z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const IconGlobe = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
);
export const IconLock = (p: P) => (
  <svg {...base} {...p}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" /><path d="M12 15v2" /></svg>
);
export const IconArrow = (p: P) => (
  <svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base} strokeWidth={2.2} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconTelegram = (p: P) => (
  <svg {...base} {...p}><path d="M21 4 3 11l6 2.5M21 4l-4 16-8-6.5M21 4 9 13.5v5l3-3" /></svg>
);
