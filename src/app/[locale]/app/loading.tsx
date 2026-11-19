import { useTranslations } from "next-intl";

function Bar({ className }: { className: string }) {
  return <div className={`rounded-theme bg-surface-2 motion-safe:animate-pulse ${className}`} />;
}

/** Skeleton shown inside the /app shell while a page's data loads. Theme tokens only; no motion if reduced. */
export default function AppLoading() {
  const t = useTranslations("errors");
  return (
    <div role="status" aria-live="polite" className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex flex-col gap-4" aria-hidden="true">
        <div className="flex items-center justify-between gap-4 rounded-theme-lg border border-line bg-surface p-4">
          <div className="flex flex-1 flex-col gap-3">
            <Bar className="h-7 w-2/3 max-w-xs" />
            <Bar className="h-4 w-1/2 max-w-[14rem]" />
          </div>
          <div className="size-24 shrink-0 rounded-full bg-surface-2 motion-safe:animate-pulse sm:size-32" />
        </div>
        <div className="flex flex-col gap-3 rounded-theme-lg border border-line bg-surface p-4">
          {[0, 1, 2, 3].map((i) => (
            <Bar key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
      <div className="hidden flex-col gap-3 rounded-theme-lg border border-line bg-surface p-4 lg:flex" aria-hidden="true">
        <Bar className="h-5 w-1/2" />
        <Bar className="h-24 w-full" />
      </div>
    </div>
  );
}
