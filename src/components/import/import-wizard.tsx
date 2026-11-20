"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useState, useTransition } from "react";
import { commitImport, type CommitResult } from "@/app/[locale]/app/import/actions";
import { Link } from "@/i18n/navigation";
import {
  autoMap, buildImport, missingRequiredFields, parseCsv, TARGET_FIELDS, toMapping, toTable, unmappedImpact,
  type ColumnGuess, type ColumnMapping, type RawCell, type RawTable, type TargetField,
} from "@/lib/import";
import type { Locale } from "@/lib/notify/i18n";
import { MAX_IMPORT_ROWS, templateCsv } from "./template";

export interface ImportCompany {
  id: string;
  name: string;
}

type Step = "upload" | "map" | "preview" | "done";
const STEPS: Step[] = ["upload", "map", "preview", "done"];
const REQUIRED: TargetField[] = ["full_name", "start_date"];
const PREVIEW_ROWS = 10;
const ERRORS_SHOWN = 50;

const btn = "rounded-theme bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50";
const btnGhost = "rounded-theme border border-control px-4 py-2.5 text-sm font-medium hover:bg-surface-2";
const card = "rounded-theme-lg border border-line bg-surface";

function cellText(v: RawCell): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

/** Server actions serialize Date, but plain values are smaller and safer; normalise undefined → null. */
function serializable(table: RawTable): RawTable {
  return {
    headers: table.headers,
    rows: table.rows.map((r) => ({ rowNumber: r.rowNumber, cells: table.headers.map((_, i) => r.cells[i] ?? null) })),
  };
}

async function readFile(file: File): Promise<RawCell[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readXlsxGrid } = await import("@/lib/import/xlsx-browser");
    return readXlsxGrid(file);
  }
  return parseCsv(await file.text());
}

const fmtDate = (iso: string | null) => (iso ? iso.split("-").reverse().join(".") : "—");

export function ImportWizard({ locale, companies }: { locale: Locale; companies: ImportCompany[] }) {
  const t = useTranslations("import");
  const tRoot = useTranslations();
  const ids = { company: useId(), file: useId() };

  const [step, setStep] = useState<Step>("upload");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<RawTable | null>(null);
  const [guesses, setGuesses] = useState<ColumnGuess[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [committing, startCommit] = useTransition();

  const field = (f: TargetField) => t(`fields.${f}`);

  const preview = useMemo(
    () => (table && step !== "upload" ? buildImport(table, mapping, { orgId: "preview", companyId: "preview", newId: () => crypto.randomUUID() }) : null),
    [table, mapping, step],
  );
  const missing = missingRequiredFields(mapping);
  const unmapped = unmappedImpact(mapping);
  const duplicates = useMemo(() => {
    const seen = new Map<TargetField, number>();
    for (const f of Object.values(mapping)) if (f) seen.set(f, (seen.get(f) ?? 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([f]) => f);
  }, [mapping]);

  if (!companies.length) {
    return (
      <div className={`${card} flex flex-col items-start gap-3 p-5`}>
        <p>{t("noCompanies")}</p>
        <Link href="/app" className={btn}>{t("addCompany")}</Link>
      </div>
    );
  }

  async function onFile(file: File | undefined) {
    setUploadError(null);
    if (!file) return;
    setReading(true);
    setFileName(file.name);
    try {
      const parsed = toTable(await readFile(file));
      if (!parsed.headers.length || !parsed.rows.length) return setUploadError(t("empty"));
      if (parsed.rows.length > MAX_IMPORT_ROWS) return setUploadError(t("tooManyRows", { count: parsed.rows.length, max: MAX_IMPORT_ROWS }));
      const g = autoMap(parsed.headers);
      setTable(serializable(parsed));
      setGuesses(g);
      setMapping(toMapping(g));
      setStep("map");
    } catch {
      setUploadError(t("readError"));
    } finally {
      setReading(false);
    }
  }

  function downloadTemplate() {
    const csv = templateCsv(locale, field, { name: t("templateSample.name"), ground: t("templateSample.ground") });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `tesuch-import-${locale}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  function commit() {
    if (!table) return;
    startCommit(async () => {
      const mappingPayload = Object.fromEntries(Object.entries(mapping).map(([k, v]) => [k, v ?? null]));
      try {
        setResult(await commitImport(locale, { companyId, headers: table.headers, rows: table.rows as { rowNumber: number; cells: (string | number | boolean | Date | null)[] }[], mapping: mappingPayload }));
      } catch {
        setResult({ ok: false, error: "failed" });
      }
      setStep("done");
    });
  }

  function reset() {
    setStep("upload");
    setTable(null);
    setGuesses([]);
    setMapping({});
    setResult(null);
    setFileName("");
  }

  const errorRows = preview ? new Set(preview.errors.map((e) => e.row)).size : 0;

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label={t("title")}>
        {STEPS.map((s, i) => {
          const active = s === step;
          const done = STEPS.indexOf(step) > i;
          return (
            <li
              key={s}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 ${active ? "border-accent bg-accent text-accent-ink" : done ? "border-line bg-surface-2" : "border-line text-muted"}`}
            >
              <span className="font-semibold tabular-nums">{done ? "✓" : i + 1}</span> {t(`steps.${s}`)}
            </li>
          );
        })}
      </ol>

      {step === "upload" && (
        <section className={`${card} flex flex-col gap-4 p-5`}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.company} className="text-sm font-medium">{t("company")}</label>
            <select id={ids.company} value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="rounded-theme border border-control bg-surface px-3 py-2.5 text-base">
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.file} className="text-sm font-medium">{t("file")}</label>
            <input
              id={ids.file}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => onFile(e.target.files?.[0])}
              aria-describedby={`${ids.file}-hint`}
              className="rounded-theme border border-dashed border-control bg-bg px-3 py-6 text-sm file:mr-3 file:rounded-theme file:border-0 file:bg-accent file:px-3 file:py-2 file:font-semibold file:text-accent-ink"
            />
            <p id={`${ids.file}-hint`} className="text-xs text-muted">{t("fileHint", { max: MAX_IMPORT_ROWS })}</p>
          </div>
          {reading && <p role="status" className="text-sm text-muted">{t("reading")}</p>}
          {uploadError && <p role="alert" className="text-sm text-danger">{uploadError}</p>}
          <button type="button" onClick={downloadTemplate} className={`${btnGhost} self-start`}>⬇ {t("template")}</button>
        </section>
      )}

      {step === "map" && table && (
        <section className={`${card} flex flex-col gap-4 p-4 sm:p-5`}>
          <div>
            <h2 className="text-lg font-semibold">{t("mapTitle")}</h2>
            <p className="text-sm text-muted">{t("mapIntro")}</p>
            <p className="mt-1 text-xs text-muted">{fileName} · {t("rowsFound", { count: table.rows.length })}</p>
          </div>
          <ul className="flex flex-col divide-y divide-line rounded-theme border border-line">
            {guesses.map((g) => {
              const value = mapping[g.column] ?? "";
              const sample = table.rows.map((r) => cellText(r.cells[g.column])).find((s) => s.trim()) ?? "";
              const conf = value !== g.field ? null : g.confidence >= 0.9 ? "high" : g.confidence > 0 ? "low" : "none";
              const selectId = `col-${g.column}`;
              return (
                <li key={g.column} className="grid gap-2 p-3 sm:grid-cols-[1fr_1fr] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <label htmlFor={selectId} className="min-w-0 truncate text-sm font-medium">{g.header || `#${g.column + 1}`}</label>
                      {conf && (
                        <span className={`shrink-0 text-xs font-medium ${conf === "high" ? "text-ok" : conf === "low" ? "text-warn" : "text-muted"}`}>
                          {conf === "high" ? "✓ " : ""}{t(`confidence.${conf}`)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted">{t("sample")}: {sample || "—"}</p>
                  </div>
                  <select
                    id={selectId}
                    value={value}
                    onChange={(e) => setMapping((m) => ({ ...m, [g.column]: (e.target.value || null) as TargetField | null }))}
                    className="w-full min-w-0 rounded-theme border border-control bg-surface px-2 py-2 text-sm"
                  >
                    <option value="">{t("skip")}</option>
                    {TARGET_FIELDS.map((f) => (
                      <option key={f} value={f}>{field(f)}{REQUIRED.includes(f) ? ` (${t("required")})` : ""}</option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
          {missing.length > 0 && (
            <p role="alert" className="text-sm text-danger">{t("missingRequired", { fields: missing.map(field).join(", ") })}</p>
          )}
          {duplicates.map((f) => <p key={f} role="alert" className="text-sm text-danger">{t("duplicateTarget", { field: field(f) })}</p>)}
          <div className="flex justify-between gap-3">
            <button type="button" onClick={reset} className={btnGhost}>{t("back")}</button>
            <button type="button" onClick={() => setStep("preview")} disabled={missing.length > 0 || duplicates.length > 0} className={btn}>{t("next")}</button>
          </div>
        </section>
      )}

      {step === "preview" && preview && (
        <section className={`${card} flex flex-col gap-4 p-4 sm:p-5`}>
          <h2 className="text-lg font-semibold">{t("previewTitle")}</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-surface-2 px-3 py-1 font-semibold text-ok">✓ {t("validRows", { count: preview.employees.length })}</span>
            {errorRows > 0 && <span className="rounded-full bg-surface-2 px-3 py-1 font-semibold text-danger">⚠ {t("errorRows", { count: errorRows })}</span>}
          </div>
          <p className="text-xs text-muted">{t("dupHint")}</p>

          <div role="note" className="rounded-theme border border-warn p-3 text-sm">
            <p className="font-semibold">{t("unmappedTitle")}</p>
            <p className="mt-1 text-muted">{t("unmappedIntro")}</p>
            <ul className="mt-2 list-inside list-disc">
              {unmapped.map((u) => <li key={u.field}>{t(`impact.${u.field}`)}</li>)}
              <li>{t("leaveNote")}</li>
            </ul>
          </div>

          {preview.errors.length > 0 && (
            <div className="overflow-x-auto rounded-theme border border-line">
              <table className="w-full text-left text-sm">
                <caption className="px-3 py-2 text-left font-semibold">{t("errorsTitle")}</caption>
                <thead className="bg-surface-2 text-xs text-muted">
                  <tr><th scope="col" className="px-3 py-2">{t("row")}</th><th scope="col" className="px-3 py-2">{t("field")}</th><th scope="col" className="px-3 py-2">{t("problem")}</th></tr>
                </thead>
                <tbody>
                  {preview.errors.slice(0, ERRORS_SHOWN).map((e, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2 tabular-nums">{e.row}</td>
                      <td className="px-3 py-2">{field(e.field)}</td>
                      <td className="px-3 py-2 text-danger">{tRoot(e.key)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.errors.length > ERRORS_SHOWN && <p className="px-3 py-2 text-xs text-muted">{t("moreErrors", { count: preview.errors.length - ERRORS_SHOWN })}</p>}
            </div>
          )}

          {preview.employees.length > 0 && (
            <div className="overflow-x-auto rounded-theme border border-line">
              <table className="w-full text-left text-sm">
                <caption className="px-3 py-2 text-left font-semibold">{t("firstRows")}</caption>
                <thead className="bg-surface-2 text-xs text-muted">
                  <tr>
                    {(["full_name", "birth_date", "contract_type", "start_date", "end_date", "probation_end"] as const).map((f) => (
                      <th key={f} scope="col" className="whitespace-nowrap px-3 py-2">{field(f)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.employees.slice(0, PREVIEW_ROWS).map((e, i) => {
                    const c = preview.contracts[i];
                    return (
                      <tr key={e.id} className="border-t border-line">
                        <td className="whitespace-nowrap px-3 py-2 font-medium">{e.full_name}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtDate(e.birth_date)}</td>
                        <td className="whitespace-nowrap px-3 py-2">{c.type === "fixed_term" ? t("fixedTerm") : t("indefinite")}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtDate(c.start_date)}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtDate(c.end_date)}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtDate(c.probation_end)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {committing && <p role="status" className="text-sm text-muted">{t("importing")}</p>}
          <div className="flex justify-between gap-3">
            <button type="button" onClick={() => setStep("map")} disabled={committing} className={btnGhost}>{t("back")}</button>
            <button type="button" onClick={commit} disabled={committing || preview.employees.length === 0} className={btn}>
              {t("import", { count: preview.employees.length })}
            </button>
          </div>
        </section>
      )}

      {step === "done" && result && (
        <section className={`${card} flex flex-col gap-3 p-5`} aria-live="polite">
          {result.ok ? (
            <>
              <h2 className="text-lg font-semibold text-ok">✓ {t("doneTitle")}</h2>
              <ul className="flex flex-col gap-1 text-sm">
                <li>{t("imported", { count: result.imported })}</li>
                {result.skippedDuplicates > 0 && <li className="text-muted">{t("skippedDuplicates", { count: result.skippedDuplicates })}</li>}
                {result.skippedErrors > 0 && <li className="text-muted">{t("skippedErrors", { count: result.skippedErrors })}</li>}
                {result.findings !== null && <li>{t("findings", { count: result.findings })}</li>}
                {result.score !== null && <li className="font-semibold">{t("score", { score: result.score })}</li>}
                {result.findings === null && <li className="text-warn">{t("rulesFailed")}</li>}
              </ul>
              {result.possibleDuplicates.length > 0 && (
                <div role="note" className="rounded-theme border border-warn p-3 text-sm">
                  <p className="font-semibold text-warn">⚠ {t("possibleDuplicates", { count: result.possibleDuplicates.length })}</p>
                  <p className="mt-1 text-muted">{t("possibleDuplicatesHint")}</p>
                  <ul className="mt-2 list-inside list-disc">
                    {result.possibleDuplicates.slice(0, 20).map((name, i) => <li key={i}>{name}</li>)}
                  </ul>
                  {result.possibleDuplicates.length > 20 && <p className="mt-1 text-xs text-muted">{t("moreNames", { count: result.possibleDuplicates.length - 20 })}</p>}
                </div>
              )}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href={`/app/companies/${result.companyId}`} className={btn}>{t("openCompany")}</Link>
                <button type="button" onClick={reset} className={btnGhost}>{t("importMore")}</button>
              </div>
            </>
          ) : (
            <>
              <p role="alert" className="text-danger">{t(`commitError.${result.error}`)}</p>
              <div className="flex gap-3">
                {result.error !== "forbidden" && result.error !== "partial" && <button type="button" onClick={() => setStep("preview")} className={btnGhost}>{t("back")}</button>}
                <button type="button" onClick={reset} className={btnGhost}>{t("importMore")}</button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
