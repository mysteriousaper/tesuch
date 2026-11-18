import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContractDocs, type ContractRow } from "@/components/documents/contract-docs";
import { CompanyPicker } from "@/components/documents/company-picker";
import { formatDate } from "@/lib/notify/i18n";
import { supabaseForUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface EmployeeRow {
  id: string;
  full_name: string;
  contracts: ContractRow[];
}

export default async function DocumentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ company?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { company: requested } = await searchParams;
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

  const { data: employees } = await db
    .from("employees")
    .select("id, full_name, contracts(id, type, start_date, end_date, probation_end, terminated_on)")
    .eq("company_id", company.id)
    .is("archived_at", null)
    .order("full_name");

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="max-w-2xl text-muted">{t("intro")}</p>
      </header>

      <div className="flex flex-col gap-4 rounded-theme-lg border border-line bg-surface p-4 sm:flex-row sm:items-end sm:justify-between">
        <CompanyPicker companies={companies} selected={company.id} label={t("company")} submit={t("choose")} />
        <div className="flex flex-col gap-1">
          <a
            href={`/api/pdf/checklist?company=${company.id}&locale=${locale}`}
            download
            className="inline-flex items-center justify-center rounded-theme bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
          >
            ⬇ {t("checklist")}
          </a>
          <span className="text-xs text-muted">{t("checklistHint")}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("employees")}</h2>
        {!employees?.length ? (
          <p className="rounded-theme-lg border border-dashed border-line bg-surface p-6 text-muted">{t("noEmployees")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {(employees as unknown as EmployeeRow[]).map((e) => (
              <li key={e.id} className="rounded-theme-lg border border-line bg-surface p-4">
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

      <p className="text-xs text-muted">ⓘ {t("draftNote")}</p>
    </section>
  );
}
