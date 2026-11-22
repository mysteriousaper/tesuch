"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { CoverageNote } from "@/components/coverage-note";
import { templateCsv } from "@/components/import/template";
import { Link } from "@/i18n/navigation";
import type { TargetField } from "@/lib/import";
import { coverage } from "@/lib/rules/coverage";
import { checkStaffFile, type FileCheckResult } from "./check-file";

type Locale = "hy" | "ru" | "en";
const btn = "inline-flex min-h-11 items-center justify-center rounded-theme px-5 text-sm font-semibold motion-reduce:transition-none";
const SAMPLE = { hy: { name: "", ground: "Սեզոնային աշխատանք" }, ru: { name: "", ground: "Сезонная работа" }, en: { name: "", ground: "Seasonal work" } } as const;

export function FileCheck({ locale }: { locale: Locale }) {
  const t = useTranslations("checkfile");
  const tImport = useTranslations("import");
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"empty" | "tooMany" | "unreadable" | "noStart" | null>(null);
  const [result, setResult] = useState<FileCheckResult | null>(null);

  async function onFile(file: File | undefined) {
    setError(null);
    setResult(null);
    if (!file) return;
    setBusy(true);
    try {
      // Everything below runs in this browser tab. The file is never sent anywhere.
      const out = await checkStaffFile(file);
      if (out.kind === "ok") setResult(out.result);
      else setError(out.kind);
    } catch {
      setError("unreadable");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const csv = templateCsv(locale, (f: TargetField) => tImport(`fields.${f}`), SAMPLE[locale], { privacy: true });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "tesuch-staff-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const status = result?.status;
  const tone = status === "clear" ? "var(--ok)" : status === "attention" ? "var(--warn)" : "var(--danger)";

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-theme-lg border border-line bg-surface p-4 text-sm leading-relaxed" data-testid="no-upload-note">
        <strong>{t("privacy.title")}</strong> {t("privacy.body")}
      </p>

      <div className="rounded-theme-lg border border-line bg-surface p-5">
        <label htmlFor={inputId} className="block font-semibold">{t("pick")}</label>
        <p className="mt-1 text-sm text-muted">{t("pickHint")}</p>
        <input
          id={inputId}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="mt-3 block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-theme file:border-0 file:bg-accent file:px-4 file:font-semibold file:text-accent-ink"
        />
        <button type="button" onClick={downloadTemplate} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
          {t("template")}
        </button>
      </div>

      <div aria-live="polite" className="flex flex-col gap-6">
        {busy && <p className="text-muted">{t("reading")}</p>}
        {error && <p role="alert" className="rounded-theme-lg border border-danger p-4 font-medium">{t(`error.${error}`)}</p>}

        {result && (
          <section aria-labelledby="cf-result" className="flex flex-col gap-5" data-testid="file-result">
            <div className="rounded-theme-lg border-2 bg-surface p-5" style={{ borderColor: tone }}>
              <h2 id="cf-result" className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">{t("result.title")}</h2>
              <p className="mt-2 text-3xl font-bold" style={{ color: tone }} data-testid="status">{t(`status.${status}`)}</p>
              <p className="mt-1 text-sm text-muted">{t(`statusHint.${status}`)}</p>
              <p className="mt-3 text-sm">{t("result.read", { staff: result.staff, rows: result.rowCount })}</p>
              <p className="mt-2 text-xs text-muted">{t("result.advisory")}</p>
            </div>
            <CoverageNote titles={coverage(locale).titles} summary={t("coverage.summary", { n: coverage(locale).count })} listLabel={t("coverage.list")} note={t("coverage.note")} />

            {result.groups.length > 0 ? (
              <section aria-labelledby="cf-issues">
                <h2 id="cf-issues" className="text-xl font-bold">{t("issues.title")}</h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {result.groups.map((g) => (
                    <li key={g.ruleId} className="rounded-theme-lg border border-line bg-surface p-4">
                      <h3 className="font-semibold">{g.title[locale]}</h3>
                      <p className="mt-1 text-sm text-muted">{t("issues.affected", { n: g.codes.length, codes: g.codes.slice(0, 6).join(", ") + (g.codes.length > 6 ? " …" : "") })}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="rounded-theme-lg border border-line bg-surface p-4">{t("issues.none")}</p>
            )}

            {result.errors.length > 0 && (
              <section aria-labelledby="cf-errors">
                <h2 id="cf-errors" className="text-xl font-bold">{t("errors.title", { n: result.errors.length })}</h2>
                <p className="mt-1 text-sm text-muted">{t("errors.hint")}</p>
                <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{t("errors.line", { row: e.row, field: tImport(`fields.${e.field}`), reason: tImport(e.key.replace(/^import\./, "") as "error.required") })}</li>
                  ))}
                </ul>
              </section>
            )}

            {result.missing.length > 0 && (
              <section aria-labelledby="cf-missing">
                <h2 id="cf-missing" className="text-xl font-bold">{t("missing.title")}</h2>
                <p className="mt-1 text-sm text-muted">{t("missing.hint")}</p>
                <ul className="mt-3 list-disc pl-5 text-sm">
                  {result.missing.map((f) => <li key={f}>{tImport(`fields.${f}`)}</li>)}
                </ul>
              </section>
            )}

            <div className="rounded-theme-lg bg-accent p-6 text-accent-ink">
              <h2 className="text-xl font-bold">{t("cta.title")}</h2>
              <p className="mt-2 opacity-90">{t("cta.body")}</p>
              <Link href="/login" className={`${btn} mt-4`} style={{ background: "var(--accent-ink)", color: "var(--accent)" }}>{t("cta.button")}</Link>
            </div>
          </section>
        )}
      </div>

      <ul className="grid gap-3 text-sm text-muted sm:grid-cols-2">
        <li><Link href="/check" className="font-semibold underline underline-offset-4">{t("alt.quiz")}</Link></li>
        <li><Link href="/security" className="font-semibold underline underline-offset-4">{t("alt.security")}</Link></li>
      </ul>
    </div>
  );
}
