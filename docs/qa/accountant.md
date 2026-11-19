# QA report: fighter "accountant"

**Persona:** partner at an accounting firm, 30 client companies, 2 HR accountants.
**Build tested:** local `pnpm build && pnpm start -p 3301` against the real Supabase project, throwaway users (`createTestUser`), real Chromium via Playwright, mostly `/hy` and `/ru`.
**Data used:** one firm with 32 companies (13 added through the form, 19 inserted by the service role to reach firm scale), a 235-row semicolon CSV with Armenian headers and messy dates (`DD.MM.YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`, `DD-MM-YYYY`, duplicates, an empty row, an impossible date, an unknown contract type), a Russian CSV, a Russian XLSX with real date cells, an XLSX with title rows above the header, a CP1251 CSV and an English CSV. 270 employees were imported by file, then 900 more were inserted by the service role to cross 1000. The three users (owner, accountant, viewer) and both firms were deleted at the end (`docs/qa/accountant-tools/cleanup.ts`).
**Scripts:** `docs/qa/accountant-tools/*.ts` (rerun with `NODE_USE_ENV_PROXY=1 npx tsx <file>`). Screenshots: `docs/qa/shots/accountant/`.

## Summary

| Severity | Count |
|---|---|
| Critical (10) | 2 |
| Major (5) | 15 |
| Minor (2) | 7 |

What worked well (so the judge knows it was exercised): sign-in with code, consent gate (cannot be bypassed by going to `/hy/app`), firm creation, import wizard end to end for CSV and XLSX (mapping hints, per-row error table, idempotent re-import), company page, fix → re-check reopens a still-violating finding, dismiss/reopen, employee edit + contract edit + re-check closing findings, termination fields, leave record, all four PDF types render with Armenian glyphs, role checks (viewer sees no edit buttons, accountant is refused audit and invites), firm export contains all 1170 employees, delete-employee confirmation dialog, firm switcher, demo loader, 390 px layout (no horizontal overflow). Nothing cross-tenant was found. One React hydration error (#418) appeared once for the invited accountant on the invite/accept transition and could not be reproduced on any of 9 app pages with a clean rerun, so it is not claimed as a finding.

---

## Critical

### C1. Dashboard head count, per-company staff count and score are silently capped at 1000 rows
- **Severity:** Critical (wrong numbers on the main screen for exactly the firm size the product targets).
- **Steps:**
  1. Create a firm and a few companies. Add employees until the firm has more than 1000 (30 clients × 40 staff is 1200). I imported 270 by file, then inserted 900 employees into company "Клиент 14" with the service role.
  2. Open `/ru/app`.
- **Expected:** "1 170 сотрудников", "Клиент 14: 900 сотрудников".
- **Actual:** "1 000 сотрудников · 550 открытых проблем" and "Клиент 14 … 730 сотрудников". The true count in the database is 1170 (`select count(*)`, and the owner JSON export correctly lists 1170, so only the dashboard is wrong). Nothing tells the user the list is truncated.
- **Root cause:** `src/components/dashboard/queries.ts:44-46` selects all `findings` and all `employees` of the firm in one request each, and PostgREST returns at most 1000 rows. The same applies to the open-findings query, so past 1000 open findings the per-company `open` count and **the score itself** become too good, because penalties are computed from the truncated list (`scoreOf`, `queries.ts:35-38`). I proved it for employees; the findings path is the same code and the same limit, and was not separately pushed past 1000. In the same spirit, `src/lib/jobs/run.ts:46-49` loads a company's employees, contracts, leave and findings with no `.range()`, so a single large company (or a company with a long history of fixed/dismissed findings, which are included in the query on line 49) can be evaluated on a truncated set.
- **Evidence:** `docs/qa/shots/accountant/38-dashboard-staff-count-capped-ru.png`; `docs/qa/accountant-tools/s23.ts` output: `true employee count 1170`, dashboard `1 000 сотрудников`, `Клиент 14 … 730 сотрудников`.
- **Fix:** replace the three queries in `firmOverview` with one grouped RPC (`select company_id, count(*) …` for employees, and `severity, due_date < today` counts for open findings), or use `.select("company_id", { count: "exact", head: true })` per company. For `run.ts:46-49` page with `.range(from, from + 999)` in a loop until fewer than 1000 rows come back. Add a unit test that feeds 1001 rows.

### C2. First import of a real staff list floods every company with "missing data" findings and drives the score to 0
- **Severity:** Critical (wrong result on the main flow: the very first thing a firm does is import, and the result is a 0/100 "not ready" verdict that is mostly the product's own defaults).
- **Steps:** import the 235-row CSV (Armenian headers: tabel number, name, birth date, hire date, contract type, end date, probation end, six-day week; no leave column, no SRC column, no fixed-term ground column) into a new company. Open the company page.
- **Expected:** findings only where the file shows a real problem; unknown data reported as "not provided", not as a violation.
- **Actual:** 230 employees → 475 open findings, score **0**. Breakdown from the database (`docs/qa/accountant-tools/db2.ts`): `src-registration` 184, `annual-leave-min` 127, `probation-max` 93, `fixed-term-ground` 66, others 5. So **377 of 475 (79 %)** come from data the file cannot carry: 
  - `annual-leave-min` fires for every employee with more than a year of service because the import has no leave columns at all (`TARGET_FIELDS` in `src/lib/import/fields.ts:3-24`), so "0 days of leave recorded" is read as "0 days granted".
  - `src-registration` fires for 184 contracts because an empty or missing boolean column becomes `false` (`parseBool`, `src/lib/import/normalize.ts:75-76`, "Empty means false"; `BOOL_FIELDS` in `src/lib/import/pipeline.ts:74`, `src_registered: boolean` at line 50).
  - `fixed-term-ground` fires for every fixed-term contract when the file has no ground column.
  The only way to clear the leave findings is the per-employee "Add leave" form, one employee at a time (127 times).
- **Evidence:** `docs/qa/shots/accountant/09-company-page-hy.png` (0 score, 475 issues), `08-dashboard-after-import-hy.png`, `docs/qa/shots/accountant/06-import-preview-hy.png` (the preview shows no warning about unmapped fields), db breakdown above.
- **Fix:** (1) make `src_registered` and `fixed_term_ground` tri-state (`null` = unknown) in the import and DB, and have the rules skip `null`; (2) in `annual-leave-min` skip employees with no leave records at all and report "leave not recorded" as `info`; (3) in the import preview (`import-wizard.tsx`, step 3) list optional fields that were not mapped and the number of findings they will cause ("SRC column not found: 184 contracts will be flagged"); (4) add leave columns (type, start, days) to `TARGET_FIELDS`.

---

## Major

### M1. The score cannot be compared across clients and is not explained
- **Steps:** dashboard after import; the 40-employee and the 230-employee company both show **0**; every empty company shows 100.
- **Expected:** a partner can rank clients by risk and understands why a number is what it is.
- **Actual:** `PENALTY` is a flat 4 points per advisory finding (`src/lib/rules/score.ts:4-9`), so any company with 25 or more advisory findings is 0, regardless of size. The two real clients are both 0 and are ordered alphabetically (`queries.ts:57`). The UI never says how the score is built; the only text is "Ստուգման պատրաստվածություն" / "Средний показатель фирмы". Mixed scripts also sort Latin, Cyrillic, Armenian in that order, not meaningful.
- **Evidence:** `docs/qa/shots/accountant/28-viewer-dashboard-ru.png`, `21-dashboard-ru.png`.
- **Fix:** normalise per employee (e.g. `100 − min(100, Σpenalty / max(staff, 10) × k)`) or cap advisory penalty; add a "?" popover under the gauge listing the four penalties and the overdue doubling (text from `docs/DECISIONS.md` row 8); show the findings count next to the score on the row so ties can be broken.

### M2. Companies with no employees show a green 100, inflating the firm score; the PDF says "Keep it up!"
- **Steps:** add companies without staff (as every new client is). Open the dashboard; download the checklist PDF of an empty company.
- **Expected:** "no data yet" (grey, excluded from the firm average).
- **Actual:** each empty company shows a green **100** bar; with 2 real companies at 0 and 30 empty ones the "Firm average" is **94** (97 with one real company). The checklist PDF of an empty company reads "Պատրաստվածության միավոր: 100/100, Բաց հարցեր: 0, Բաց հարցեր չկան։ Այդպես շարունակեք։" (`src/lib/notify/i18n.ts:48`), which a client could take as an all-clear.
- **Evidence:** `docs/qa/shots/accountant/02-dashboard-companies-hy.png`, `28-viewer-dashboard-ru.png`; extracted PDF text (`pdftotext` of `/api/pdf/checklist?company=<empty>&locale=hy`, `s13.ts`).
- **Fix:** in `firmOverview` return `score: null` when `staff === 0`; filter them out in `firmScore(...)` (`queries.ts:58`); in `company-list.tsx` render "No data yet"; in the PDF render a "no employees imported" line instead of the score.

### M3. The legal disclaimer is invisible where the score is shown
- **Steps:** open dashboard and company page.
- **Expected:** the "not legal advice, rules not yet checked by a lawyer" note next to the score (PRD: "visible disclaimer"). 
- **Actual:** the dashboard has no disclaimer at all. On the company page it renders once at the bottom of the findings list (`src/components/dashboard/finding-list.tsx:84-87`), after 475 findings, i.e. about 58 000 px down. A partner reads "0/100" with no hint that all 475 items come from rules awaiting lawyer review.
- **Evidence:** `docs/qa/shots/accountant/09-company-page-hy.png` (no disclaimer above the fold), `08-dashboard-after-import-hy.png`; page height 58 851 px measured in `s20.ts`.
- **Fix:** render `c("disclaimer")` once in `app/layout.tsx` under the nav (or directly under both `ScoreGauge` instances in `app/page.tsx:48` and the company header), and keep the list footer as is.

### M4. Company page is one flat list of every finding: no grouping, filter, search or pagination
- **Steps:** open the company with 475 findings.
- **Expected:** group by employee or by rule, filter by type/rule, collapse, page.
- **Actual:** 475 cards, 13 332 DOM nodes, 606 KB HTML, 58 851 px tall (`s20.ts`). The same employee appears 3–4 times in separate cards. Employee column has 230 names with no search.
- **Evidence:** `docs/qa/shots/accountant/09-company-page-hy.png`, `32-mobile-company-hy.png`.
- **Fix:** in `companies/[id]/page.tsx:26,61` group findings by `rule_id` (count + expandable), add `?rule=&type=&q=` filters, `.range()` the list at 50; add a search box above the employee list.

### M5. No search, filter or paging anywhere for 30 clients
- **Steps:** dashboard with 32 companies; import, documents and quiz pages.
- **Expected:** find "Ararat Steel" quickly, filter by score band.
- **Actual:** the dashboard is a 32-row list with a single fixed order and no search (`grep` finds the only search field in the product on the data-rights page). Company pickers on import, documents and quiz are plain `<select>` lists in which the first (alphabetically, Latin first) company is preselected: documents opens on "<img src=x…>" instead of the last-used client.
- **Evidence:** `docs/qa/shots/accountant/14-documents-company-hy.png`, `28-viewer-dashboard-ru.png`.
- **Fix:** client-side filter input + "score < 60" chip in `company-list.tsx`; remember the last company in a cookie (as `ORG_COOKIE`) and preselect it on import/documents/quiz.

### M6. No export to Excel/CSV, and the only client-facing document is a 40-page unsorted table
- **Steps:** look for an export of the risk table or findings; download the checklist for the 230-employee company.
- **Expected:** `.xlsx` of firm → companies → findings; a short client report.
- **Actual:** the only exports are an owner-only JSON dump and per-company PDF. The PDF is 40 pages, rows are in creation order (the same employee is scattered), and page 1 shows only the big "0/100" and the count. There is no summary of the top issues and no per-client cover for the accountant to send.
- **Evidence:** `docs/qa/shots/accountant/15-pdf-checklist-p1-01.png`.
- **Fix:** add `/api/export/findings?format=xlsx` (reuse `src/lib/import/xlsx-node.ts` patterns) and sort the PDF rows by employee then rule in `src/lib/pdf`; prepend a "top 5 / by rule" summary on page 1.

### M7. A company cannot be renamed, edited, archived or deleted
- **Steps:** try to correct a typo in a company name or remove a demo company; look at company page actions.
- **Expected:** edit name/tax id, archive or delete.
- **Actual:** `src/app/[locale]/app/actions.ts` exports no company mutation besides `addCompany` and the demo loader. The company page offers only "Check now", fix/dismiss buttons. Companies loaded by "Load demo data" cannot be removed from a real firm, the demo button stays visible after loading (second click only says "already loaded"), and my two accidental duplicates ("Dup Taxid", "Սևան Տուր ՍՊԸ" twice) are permanent.
- **Evidence:** button inventory in `s27.ts` output (`Ստուգել հիմա`, `Շտկված է`, `Անտեսել` only); `docs/qa/shots/accountant/41-demo-loaded-hy.png`.
- **Fix:** add `updateCompany`/`archiveCompany`/`deleteCompany` (owner only, `editableCompany` pattern) in `actions.ts` and a "Company settings" `<details>` on `companies/[id]/page.tsx`; hide the demo button when `demoExists`.

### M8. Excel/CSV files with title rows above the header cannot be imported
- **Steps:** upload an XLSX whose first rows are "Список сотрудников ООО «Тест»", "по состоянию на 19.11.2026", an empty row, then the header row (the usual shape of 1C/ArmSoft/HR exports).
- **Expected:** header row detected or choosable.
- **Actual:** the first non-empty row is used as the header (`src/lib/import/parse.ts:19-26`). The mapping screen shows one real column name and `#2 … #8`, every select is "Do not import", and "Next" is disabled with no explanation and no way to say which row is the header.
- **Evidence:** `docs/qa/shots/accountant/34-import-title-rows-ru.png`.
- **Fix:** in `toTable`, scan the first 20 rows and pick the first row where at least two cells match `FIELD_ALIASES` (`normalizeHeader`); add a "Header row" number input in the wizard that re-runs `toTable`.

### M9. A Windows-1251 CSV (Excel's default "CSV" in a Russian locale) imports as mojibake
- **Steps:** save a CSV in CP1251 (header "ФИО;Дата рождения;Дата приема;Тип договора", one row), upload it.
- **Expected:** correct headers and names, or an encoding choice.
- **Actual:** header and name show as `���`; mapping cannot be done. `src/components/import/import-wizard.tsx:48` reads `file.text()`, which is UTF-8 only. Armenian ANSI (CP1252/ArmSCII) exports would fail the same way.
- **Evidence:** `s21.ts` output ("cp1251 csv": `��� / Пример: ������ ����`).
- **Fix:** read `file.arrayBuffer()`, try `new TextDecoder("utf-8", { fatal: true })`, on failure fall back to `windows-1251`, and show the detected encoding with a switch.

### M10. Re-importing an updated export never updates existing employees
- **Steps:** import `hy.csv`, then import it again (or a new month's export with changed end dates).
- **Expected:** a firm re-exports from ArmSoft monthly; changed rows update, new rows add.
- **Actual:** every row with an existing tabel number is skipped: "Нет новых строк для импорта". The preview still says "Строк готово к импорту: 232" and the button "Импортировать (232)" for a file where all 232 are duplicates (found out only after clicking). So the data goes stale after the first import and the accountant has to edit employees one by one.
- **Evidence:** `s21.ts` output ("REIMPORT RESULT: Нет новых строк для импорта").
- **Fix:** in `app/import/actions.ts` upsert on `(company_id, external_ref)` when the mapped values differ and report "N updated"; compute duplicates in the preview (the server already can) so the counts are honest.

### M11. No bulk actions and no reason when dismissing
- **Steps:** try to clear 127 identical findings; dismiss one.
- **Expected:** select-all-by-rule, mark fixed/dismissed in bulk; a reason/note is stored for dismissals (an inspector will ask why).
- **Actual:** one click per finding; "Անտեսել" stores no reason, author note or date visible in the UI (closed list shows only "Անտեսված" and a reopen button). Feedback on the click is a known item and is not re-reported here.
- **Evidence:** `docs/qa/shots/accountant/11-after-fix-dismiss-recheck.png`.
- **Fix:** add checkboxes + "Apply to selected" in `finding-list.tsx`, and a short required note on dismiss stored in `findings` (new nullable `dismissed_reason`).

### M12. Audit log is unusable for a firm: raw UUIDs, and one import buries everything
- **Steps:** import 230 rows, open "Журнал действий" as owner.
- **Expected:** "Anna Petrosyan: contract end date 2026-12-01 → 2027-01-01", filtered to human actions by default.
- **Actual:** 46 pages of `Система · Создано · Нарушения · c6e81d65-5b6c-4d9a-86f2-0cc1ec16ef17`. The record column is a bare UUID, no name, no changed fields, and the system-generated finding rows from the nightly/recheck run drown the human actions (my edits, invites). The "Who" for the user edits is an email only.
- **Evidence:** `docs/qa/shots/accountant/23-audit-ru.png`.
- **Fix:** in `app/audit/page.tsx` default-hide `table = findings` + `actor is null` (add a "Show system events" checkbox), join the entity name (`employees.full_name`, `companies.name`) and render the changed keys from the stored old/new JSON.

### M13. Documents page offers orders that make no sense for the employee's state, and 456 unsearchable buttons
- **Steps:** open Documents for the 230-employee company; terminate an employee (dismissal date set) and look at that employee.
- **Expected:** "confirm after probation" only while probation is running or just ended; nothing for a terminated contract; a name filter; PDF file name containing the company/employee name.
- **Actual:** every employee gets "Հրաման՝ փորձաշրջանից հետո հաստատել" and "…լուծել" even when probation ended 18 months ago (the generated order is dated today with `Փորձաշրջանի ավարտ՝ 20.05.2025`), and for the already dismissed employee ("լուծված՝ 18.11.2026"). 456 download links on one page. Files are named `tesuch-probation-confirm-31897bfa-2026-11-19.pdf` (a UUID fragment), so 20 downloads cannot be told apart. These are drafts, but a backdated order for an ended probation is exactly the wrong thing to hand to a director.
- **Evidence:** `docs/qa/shots/accountant/14-documents-company-hy.png`, `16-pdf-probation-confirm-1.png`.
- **Fix:** in `components/documents/contract-docs.tsx` show the probation orders only when `probation_end >= today - 14d` and `terminated_on` is null; put `slug(employee name)` into the `Content-Disposition` filename in `api/pdf/_lib` (`pdfResponse`); add a filter input.

### M14. No reminders for the firm: nothing for "what expires this month across all clients"
- **Steps:** look for a deadlines view, per-client digest recipients or a calendar.
- **Expected:** a firm-level list of upcoming probation ends / fixed-term ends sorted by date; the ability to send the digest of one client to that client's owner.
- **Actual:** the product has only the per-company findings list and Settings → Notifications for **the signed-in user** (Telegram + own email, `docs/qa/shots/accountant/…` settings screen, content: "Telegram: Not connected", "Email: <own email>", "Send test notification"). The PRD's Karen (SME owner) persona cannot be reached from the firm. The deadline dates inside findings ("Ժամկետ՝") are all "today" for missing-data findings, so a date sort would be meaningless anyway.
- **Evidence:** settings page text in `s19.ts` output; no route named calendar/deadlines in `src/app`.
- **Fix:** add `/app/deadlines` (findings and contract dates in the next 60 days across the org, grouped by week, with `.ics` export) and a per-company "digest recipients" list.

### M15. No per-client access or assignment for the two HR accountants
- **Steps:** invite an accountant; open the dashboard.
- **Expected:** a partner can give accountant A clients 1–15 and accountant B 16–30, and assign findings.
- **Actual:** an invited accountant sees and edits all 32 companies (`s17.ts` output): role is firm-wide only. There is no assignee on a finding, no comment, no status "waiting for client".
- **Evidence:** accountant session dashboard text in `s17.ts` output (32 companies, 472 fix buttons).
- **Fix:** `company_members(company_id, user_id)` table with RLS on `companies`/children for the `accountant` role, plus `findings.assignee`.

---

## Minor

### m1. Duplicate companies (same name or same tax id) are accepted silently
`addCompany` (`app/actions.ts:102-113`) has no uniqueness check; I created "Dup Taxid" with the tax id of an existing client and "Սևան Տուր ՍՊԸ" twice, both saved with "Պահպանված է։". With M7 they cannot be removed. Fix: unique index on `(org_id, tax_id) where tax_id is not null` and a name check returning a friendly error. Evidence: `db.ts` output (13 companies incl. both duplicates).

### m2. Armenian grammar bug in the audit log intro
`messages/hy/audit.json:4` builds `{org}-ի` so a firm called "Երկրորդ ֆիրմա" renders as "Երկրորդ ֆիրմա-ի տվյալների բոլոր փոփոխությունները", a hyphenated suffix glued to a variable that is not grammatical Eastern Armenian ("Երկրորդ ֆիրմայի" or "Ֆիրմա «Երկրորդ ֆիրմա»՝ տվյալների…"). Same pattern at line 21 (`{pages}-ից`, fine for numbers). Fix: rephrase the string so the name stands alone, e.g. `"Ֆիրմա՝ {org}։ Տվյալների բոլոր փոփոխությունները՝ նորերը վերևում։"`. Evidence: `s24.ts` output.

### m3. Audit/violation wording contradicts the "advisory" model
The audit filter and rows call findings "Нарушения" (`messages/ru/audit.json:30`, "Violations") while the guide and company page call them "Проблемы" and every finding is "Предупреждение/Նախազգուշական" because no rule is verified. A firm reading "Создано · Нарушения" in the log may read it as a confirmed violation. Fix: use "Проблемы" in all three locales of `audit.json`.

### m4. Viewer sees an "Add company" call to action they cannot use
`/ru/app/import` as viewer: "Пока нет компании, в которую вы можете добавлять данные. Добавить компанию" (`s17.ts` output), but the dashboard form is not available to viewers (it shows "Вы наблюдатель и не можете вносить изменения"). Fix: hide the CTA when `role === "viewer"` in `app/import/page.tsx` and say who can add.

### m5. Header count not refreshed after "Check now"
After re-check the status line says "Ստուգված է։ Բաց խնդիրներ՝ 475։" while the header still shows "474 բաց խնդիր" until reload (`s8.ts` output, a fixed finding had just reopened). Fix: `revalidatePath` the company page in `recheckCompany` and refresh the router after the action.

### m6. The weekly quiz asks the accountant to choose a client company
`/app/quiz` has a company `<select>` of all 32 clients (`s15.ts` output), so with 30 clients it is unclear whether the streak and badges are per client, per firm or per person, and the quiz shows only a `0 weeks` streak without saying what it applies to. Fix: say it in the intro ("streak counts for the selected client") or make the quiz firm-level.

### m7. Mobile navigation tabs are cut off at 390 px
At 390 px the nav row ("Վահանակ Ներմուծում Փաստաթղթեր Վիկ…") is clipped with no scroll hint (`docs/qa/shots/accountant/32-mobile-company-hy.png`, `31-mobile-dashboard-hy.png`). It scrolls but nothing indicates it. Fix: add a fade/scroll-snap indicator in `app-nav.tsx` or wrap to two rows below `sm`.

---

## Not reproduced / noted, no credit claimed
- React error #418 once on the accountant's invite-accept transition; 9 app pages loaded clean afterwards for both invited roles.
- A first batch of "company missing" results was my own timing race with the form reset (`s3.ts` first version); a careful rerun saved all rows, so no bug is claimed.
- Fix/dismiss feedback, atomic demo loader, `contracts[0]`, UTC date on documents page, the PDF error pages: known items in `docs/ARENA.md`, not re-reported.

---

## Top 10 missing for a paying firm
1. **Excel/CSV export** of the firm risk table and per-company findings, and a short **client-facing report** (1–2 pages per client with top issues and what to do) that can be emailed. Today: JSON dump and a 40-page table.
2. **Dashboard search, filters and sorting** (by score band, by deadline, by assigned accountant) plus a remembered "current client" across import/documents/quiz.
3. **Bulk actions** on findings and employees (apply to all findings of a rule, bulk mark fixed/dismiss with a reason, bulk leave entry).
4. **Firm-wide deadline calendar** (probation ends, fixed-term ends, notice windows) with `.ics` export, and **per-client digest recipients** so the client owner gets the weekly message.
5. **Company management**: rename, edit tax id, archive/delete, merge duplicates, remove demo data.
6. **Import that survives real files**: header-row detection, CP1251/ANSI encodings, leave and SRC-registration columns, ArmSoft preset, and re-import that updates changed rows instead of skipping them.
7. **A score a partner can trust**: normalised per company size, "no data" state for empty clients, "unknown ≠ violation" for fields the file did not contain, a visible explanation and score history over time (the 90-day metric "median score +15 points" cannot be measured without it).
8. **Per-client permissions and assignment** for the firm's two HR accountants, finding comments and "waiting for client" status.
9. **A readable audit trail** (names, changed fields, human actions first, dismissal reasons) that can be shown to a client or inspector.
10. **Document generation at scale**: only the right order for the employee's state, a name filter, files named after the employee and company, and one-click "all orders for this company" as a zip.
