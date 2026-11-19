"use client";

/** Opens the browser's print dialog ("Save as PDF" downloads the document). Hidden on paper. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-theme bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-transform hover:-translate-y-px print:hidden"
    >
      {label}
    </button>
  );
}
