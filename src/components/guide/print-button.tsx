"use client";

/** Opens the browser print dialog; "Save as PDF" there produces a file to send to a client. Hidden on paper. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center rounded-theme border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2 print:hidden"
    >
      {label}
    </button>
  );
}
