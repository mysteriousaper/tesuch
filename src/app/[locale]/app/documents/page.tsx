import { PageHead } from "@/components/ui/glassy-dashboard";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContractDocs, type ContractRow } from "@/components/documents/contract-docs";
import { CompanyPicker } from "@/components/documents/company-picker";
import { yerevanToday } from "@/components/documents/yerevan-date";
import { formatDate } from "@/lib/notify/i18n";
import { supabaseForUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const EMPLOYEE_LIMIT = 50;

interface EmployeeRow {
  id: string;
  full_name: string;
  contracts: ContractRow[];
}

export default async function DocumentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ company?: string; q?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { company: requested, q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 100);
  const t = await getTranslations("documents");
  const db = await supabaseForUser();

  const { data: companies } = await db.from("companies").select("id, name").order("name");
  if (!companies?.length) {
    return (
      <section className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="rounded-theme-lg border border-dashed border-line bg-surface p-6 text-muted">{t("noCompanies")}</p>
      </section>
    );
  }
  const company = companies.find((c) => c.id === requested) ?? companies[0];

  let query = db
    .from("employees")
    .select("id, full_name, contracts(id, type, start_date, end_date, probation_end, terminated_on)")
    .eq("company_id", company.id)
    .is("archived_at", null);
  // Name search runs in the database; LIKE wildcards typed by the user are escaped.
  if (q) query = query.ilike("full_name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const { data: employees } = await query.order("full_name").limit(EMPLOYEE_LIMIT + 1);
  const more = (employees?.length ?? 0) > EMPLOYEE_LIMIT;
  const shown = (employees ?? []).slice(0, EMPLOYEE_LIMIT);

  const today = yerevanToday();

  return (
    <section className="flex flex-col gap-6">
      <PageHead title={t("title")} description={t("intro")} />

      <div className="flex flex-col gap-4 glass p-4 sm:flex-row sm:items-end sm:justify-between">
        <CompanyPicker companies={companies} selected={company.id} label={t("company")} submit={t("choose")} />
        <div className="flex flex-col gap-1">
          <a
            href={`/api/pdf/checklist?company=${company.id}&locale=${locale}`}
            download
            className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
          >
            ⬇ {t("checklist")}
          </a>
          <span className="text-xs text-muted">{t("checklistHint")}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("employees")}</h2>
        <form method="get" role="search" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="company" value={company.id} />
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("search")}
            <input type="search" name="q" defaultValue={q} maxLength={100} className="rounded-full border border-control bg-surface px-3 py-2.5 text-base" />
          </label>
          <button className="rounded-full border border-control px-4 py-2.5 text-sm font-medium hover:bg-surface-2">{t("searchApply")}</button>
        </form>
        {!shown.length ? (
          <p className="rounded-theme-lg border border-dashed border-line bg-surface p-6 text-muted">{q ? t("noMatches") : t("noEmployees")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {(shown as unknown as EmployeeRow[]).map((e) => (
              <li key={e.id} className="glass p-4">
                <p className="font-semibold">{e.full_name}</p>
                {e.contracts.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">{t("noContracts")}</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-3">
                    {[...e.contracts]
                      .sort((a, b) => b.start_date.localeCompare(a.start_date))
                      .map((c) => (
                        <ContractDocs
                          key={c.id}
                          contract={c}
                          today={today}
                          labels={{
                            heading: `${t("contract", { start: formatDate(c.start_date) })} · ${c.type === "fixed_term" ? t("fixedTerm") : t("indefinite")}${
                              c.terminated_on ? ` · ${t("terminated", { date: formatDate(c.terminated_on) })}` : ""
                            }`,
                            probationConfirm: t("probationConfirm"),
                            probationTerminate: t("probationTerminate"),
                            fixedTermEnd: t("fixedTermEnd"),
                            dismissal: t("dismissal"),
                            noticeDate: t("noticeDate"),
                            download: t("download"),
                          }}
                        />
                      ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {more && <p role="note" className="text-sm text-muted">{t("showingFirst", { count: EMPLOYEE_LIMIT })}</p>}
      <p className="text-xs text-muted">ⓘ {t("draftNote")}</p>
    </section>
  );
}
