import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { CompanyRow } from "./queries";

export function scoreTone(score: number) {
  return score >= 80 ? "bg-ok" : score >= 50 ? "bg-warn" : "bg-danger";
}

export function CompanyList({ rows }: { rows: CompanyRow[] }) {
  const t = useTranslations("dashboard");
  return (
    <ul className="divide-y divide-line">
      {rows.map((co) => (
        <li key={co.id}>
          <Link
            href={`/app/companies/${co.id}`}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2 focus-visible:bg-surface-2"
          >
            <span className="truncate font-medium">{co.name}</span>
            <span className="text-right text-lg font-bold tabular-nums" aria-label={`${co.score}/100`}>{co.score}</span>
            <span className="text-xs text-muted">
              {t("employeesCount", { count: co.staff })} · {t("openFindings", { count: co.open })}
            </span>
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span className={`block h-full ${scoreTone(co.score)}`} style={{ width: `${co.score}%` }} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
