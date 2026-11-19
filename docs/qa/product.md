# QA war: fighter "product"

Branch `claude/qa-product`, run 2026-11-19. Scope: what Tesuch must add to become a business that Armenian accounting firms and SMEs pay for. I read the repo docs, built the app locally (`pnpm build && pnpm start -p 3305`, real Supabase, throwaway user, demo data loaded, user and orgs deleted afterwards) and researched the market. Screenshots are in `docs/qa/shots/product/`; the script that produced them is `docs/qa/shots/product/tour.spec.ts` (copy it into `tests/e2e/` to run it).

Rules I followed: no invented article numbers, no invented fine amounts, no payments in the product, no AI chatbot for legal logic, free tiers only. Anything not confirmed by a source is marked **to verify**.

## 1. What exists today (seen in the running app)

| Area | State | Evidence |
|---|---|---|
| Firm dashboard | Firm gauge (average score), companies sorted riskiest first, add company, load demo data | `shots/product/03-dashboard.png` |
| Company page | Score gauge, open findings with article and arlis.am link, mark fixed / dismiss, "Re-check now", employee list | `04-company.png` |
| Employee page | Timeline (start, leave, due dates, "Today", contract end), edit contract, add leave | `05-employee.png` |
| Documents | 4 draft PDFs (probation orders, fixed-term notice, dismissal notice) plus a per-company checklist PDF | `06-documents.png` |
| Other | CSV/Excel import wizard, weekly quiz, team and invitations, audit log, Telegram connect, "send a test alert" | `06-import.png`, `06-settings.png` |
| Rules | 12 rules, all `needs_lawyer_review`, so every finding is advisory. 5 of 12 have no article number (`docs/RULES_MATRIX.md`) | demo company page: all badges say "Advisory" |

Good: the demo is convincing in 5 minutes, the UI is clean, the legal humility ("This is not legal advice. This rule is still being checked by a lawyer.") is right. The gaps below are about what a paying firm needs on day 30, not day 1.

## 2. Market research (sources linked; thin spots marked)

**How inspections work.** The Health and Labour Inspection Body (HLIB) supervises labour law and occupational health and safety. An ILO profile (old, about 2009, so procedures may have changed) says inspectors need an inspection order: planned inspections by order of the labour minister, complaint-based ones by order of the head of the inspectorate ([ILO profile](https://www.ilo.org/topics-and-sectors/labour-inspection/labour-inspection-profile-armenia)). Later reporting says planned inspections follow an annual plan and companies enter it by risk degree (same search result set; **to verify** against the HLIB charter at [translation-centre.am](https://translation-centre.am/pdf/Trans_ru/HH_KVV/Officials/HH_VV_N_755-L_11062018_03102020_en.pdf)). A 2024 US DOL report says inspectors lack full authority for unannounced inspections ([DOL](https://www.dol.gov/agencies/ilab/resources/reports/child-labor/armenia)). Council of Europe calls the mandate limited ([CoE 2025](https://rm.coe.int/rap-rcha-arm-18-2025/1680b43976)).

**Scale and violations.** HLIB reported 168 inspections in Q1 2024, with the construction sector showing the most violations; the examples named were occupational-safety ones (protective equipment, scaffolding) ([JAMnews](https://jam-news.net/labor-law-violations-in-armenia/)). In 2019 it did 1,674 supervisory actions and imposed nearly 500 fines (same search result; **to verify**). A 2025 case against a mining company cited discrimination, safety, hygiene and working-hours violations, with 30 days to fix ([ECOLUR](https://www.ecolur.org/en/news/mining/16000/)). Administrative labour-law violations are punished under the Code on Administrative Offences ([CoE 2022](https://rm.coe.int/rap-rcha-arm-16-2022/1680a64c7a)). **Fine amounts: not found in any source I could open. Do not use any amount in sales material until a lawyer confirms it** (consistent with `docs/gtm/PRICING.md`). One source's headline dollar figure contradicts its own AMD figure, so I did not use it.

**The e-contract wave (the main sales hook right now).** Employment contracts move to a digital system on the SRC electronic reporting platform. Sources disagree on dates:
- Original plan: voluntary from 1 July 2025, signing/amending/terminating digitally from 1 January 2026, existing contracts entered during 2026 ([KPMG](https://kpmg.com/am/en/home/insights/2025/01/legal-alert-january-2025.html), [Andersen](https://am.andersen.com/article/en/post-11/), [Concern Dialog via Legal 500](https://www.legal500.com/developments/thought-leadership/labor-code-updates-in-armenia-forced-downtime-compensation-digital-system-for-signing-employment)).
- Later: EY reports amendments adopted 13 February 2026; paper contracts signed after 1 January 2026 stay valid and carry no liability under the transitional rule ([EY](https://www.ey.com/en_am/technical/tax-and-law-alerts/amendments-affecting-electronic-signing-of-employment-contracts)). Search snippets say the deadline for uploading existing contracts moved from 31 December 2026 to 30 June 2028 ([Azat.tv](https://azat.tv/labor-code-amendments-armenia/)), and Chambers says mandatory processing starts 1 July 2027 ([Chambers 2026](https://chambers.com/practice-guides/guides/employment-2026/armenia/law-and-practice)). **All of this is to verify with the lawyer; I could not open the full texts (network blocked for those hosts).**
- Other recent change: paid "parental hour", Art. 207.1, Law HO-281-N, in force 10 July 2026 per one law-firm article ([armenian-lawyer.com](https://armenian-lawyer.com/business-immigration/armenia-paid-parental-hour-law/); **to verify**). A rule candidate, not yet in `rules/`.

**What firms use and the gaps.**
- ArmSoft is described as the most widespread accounting software in Armenia ([staff.am profile](https://www.staff.am/en/company/haykakan-cragrer-sp-armsoft), vendor-adjacent, **to verify**). Its personnel and payroll module exists in practice (airport operator job post: [Zvartnots](https://www.zvartnots.aero/img/cms/HR_Accountant_Armsoft_ENG.pdf)). AS-Bookkeeper is listed as free for accountants under a small-business programme ([SoftwareOne](https://platform.softwareone.com/product/as-bookkeeper/PCP-3099-7133)); the AS-Accountant price is not published ([G2](https://www.g2.com/products/armsoft/pricing)). I found no sign that ArmSoft alerts on Labour Code deadlines (absence of evidence, **ask pilots**).
- 1C is sold in Armenia through a partner ([INFOEXPERT on spyur](https://www.spyur.am/en/companies/3679)); ERP vendors such as Matiyas offer an Armenian payroll module, no prices ([matiyas.com](https://www.matiyas.com/?p=27582)).
- Local HR/payroll SaaS: Himnark, a cloud HR and payroll platform backed by an EU grant, whose founders said existing solutions are too expensive for Armenian SMEs ([EU Neighbours East](https://euneighbourseast.eu/news/stories/eu-supported-armenian-start-up-develops-a-solution-to-automate-payroll-and-human-resources-policy/)). Sources are 2017–2020; current status **to verify**. Partnered with Grant Thornton Armenia ([press release](https://grantthornton.am/press/press-releases-2020/Grant-Thornton-Armenia-Himnark)), so accounting firms do buy this category.
- Foreign payroll/EOR players (Remote, Mercans, G-P, TopSource) serve foreign companies hiring in Armenia, not local SMEs ([PeopleManagingPeople list](https://peoplemanagingpeople.com/tools/best-employer-of-record-armenia/)).
- Regional analogue for the feature: HRiFlow (Romania) ships reminders for probation endings, notice periods and the national contract-registry deadlines ([HRiFlow](https://hriflow.ro/en/blog-en/hriflow-reminders-functionality-types-and-best-practices/)). Kazakhstan runs a comparable digital labour-contract registry with administrative liability ([EY Kazakhstan](https://www.ey.com/en_kz/technical/tax-alerts/2026/01/kazakhstan-code-administrative-violations-usrec-employment-contracts)). Neither Armenian competitor nor analogue I found sells "inspection readiness score across many clients". That slot looks open, **to confirm in pilot interviews**.

**Pricing signals.** No AMD price was found for ArmSoft, 1C or Himnark. The only data points: AS-Bookkeeper is free for accountants, and Himnark's founders say existing tools are too expensive for SMEs. So per-client pricing must be cheap next to a firm's monthly fee for that client. **Ask 10 pilots what they charge a client for HR paperwork, then price at a fraction of it.** Minimum wage was quoted as AMD 75,000 in one payroll guide ([activpayroll](https://www.activpayroll.com/global-insights/armenia), **to verify**).

## 3. Findings (WAR_RULES format)

Severity: Major = missing must-have for a paying firm (5 points each). Critical = none found in this product-scope review.

### P-1 Major: No way to give a client company (SME owner) its own view
- **Steps:** Settings → Team. Roles are `owner`, `accountant`, `viewer`, all per firm (`supabase/migrations/20261118000000_init.sql:27` memberships `(user_id, org_id, role)`; `20261119020000_members.sql:9`). Invite a client owner as `viewer`.
- **Expected:** The client owner sees only their own company, in their language, plus the Telegram digest. The PRD persona "Karen, SME owner" and the whole secondary ICP depend on this.
- **Actual:** A `viewer` sees all of the firm's clients. A firm cannot safely invite any client, so the SME channel and "weekly Telegram digest to the owner" cannot exist. Firms will paste screenshots into chats instead (data leaves the product).
- **Evidence:** `shots/product/06-settings.png`, migrations above. Founding premise of the secondary ICP in `docs/gtm/ICP.md`.
- **Fix:** Table `company_members`, helper `private.can_see_company(company_id)`, RLS update. See spec F3.

### P-2 Major: No score history, so the product cannot prove its own value
- **Steps:** Search `src` and `supabase/migrations` for score snapshots: only `quiz/streak.ts` matches. The score is recomputed live.
- **Expected:** `docs/gtm/METRICS.md` lists "median score +15 points in 60 days" sourced from "daily score snapshots", and the PRD uses it as a success metric. A firm needs a trend line to show a client.
- **Actual:** No table, no trend, no "last month vs now". The 60-day pilot cannot be measured and the case study cannot be written.
- **Evidence:** `shots/product/03-dashboard.png` shows only the current score; `grep -rln snapshot src supabase/migrations`.
- **Fix:** `score_snapshots` written by the nightly job. See spec F2.

### P-3 Major: No cross-client "what is due this week" view
- **Steps:** Dashboard → open each company. Findings are only visible one company at a time (`04-company.png`); the dashboard shows counts and a score only (`03-dashboard.png`).
- **Expected:** Anna's job in the PRD: "Show me which clients are at risk this week." She needs one list of upcoming deadlines (probation ends, fixed-term ends, notice dates) across all clients, filterable, with an owner.
- **Actual:** 5 clients means 5 page loads; 30 clients (the sweet spot) is unusable as a daily tool. No filter, no search, no assignee on a finding.
- **Fix:** Firm-level inbox. See spec F1.

### P-4 Major: The SRC e-contract topic is the biggest market trigger and the product only has a single yes/no flag
- **Steps:** Rule `rules/src-registration.json` (`basis: "deadline unclear (1 Jan 2026 or 1 Jul 2027)"`, severity amber). Open the demo company: "Contract not registered on the SRC e-platform", due today (`04-company.png`).
- **Expected:** Today is 2026-11-19 and sources say the transition rules changed in February 2026 and existing contracts must be entered by a date still to verify (see section 2). Every accounting firm has to enter every client's contracts. A firm needs a progress tracker per client (how many contracts done, how many left, by when), not a flag per contract that fires "due today" for everyone.
- **Actual:** One boolean per contract, a finding due on the day the rule runs, and a basis line that contradicts current sources. It can scare a client with a "due today" label that has no verified legal date behind it.
- **Fix:** Lawyer confirms the date and wording; replace the finding with a tracker plus a dated reminder. See spec F4. Also fix the due date logic (`"due": date asOf`) so unverified rules do not claim "due today".

### P-5 Major: Import is the only way in, and it does not fit how firms work
- **Steps:** `src/lib/import/presets.ts:8` `armsoftPreset = {}` (TODO waiting for a real export, `docs/INVESTOR_REQUESTS.md`). Known issue in `docs/ARENA.md` defect 2: re-import silently skips same-name people without birth date.
- **Expected:** Anna exports from ArmSoft or her Excel, drops it in monthly, and the app updates changes (new hires, ended contracts) without duplicates, and remembers the column mapping.
- **Actual:** First import works; later imports only add, never update, and the ArmSoft preset is empty. Activation (≥ 60 % within 24 h) and retention (monthly refresh) both rest on this.
- **Fix:** Re-sync with match key and a diff preview; saved mappings per firm; ArmSoft preset from a real anonymised file. See spec F5. Overlaps ARENA defect 2 (so no extra score for the duplicate part).

### P-6 Major: Nothing covers occupational health and safety, where the inspector actually finds most violations
- **Steps:** `ls rules/`: 12 rules, all contract and leave logic. HLIB handles safety and labour together; the only violation examples in public reporting are safety ones (JAMnews, section 2).
- **Expected:** At minimum a document-presence checklist per company and per employee (safety briefing recorded, internal rules acknowledged, etc.), without computing law we cannot verify.
- **Actual:** A company can score 100 and fail on a missing safety briefing log. "Would you pass an inspection?" is then an over-promise for construction, manufacturing and hospitality (the secondary-ICP sectors).
- **Fix:** Backlog #7 and #10: document register plus a lawyer-written checklist, advisory until verified. Consider also changing the score label to "labour-contract readiness" until OSH exists (copy decision for the lead).

### P-7 Major: No client-facing report a firm can sell
- **Steps:** Documents page offers draft orders and a checklist PDF (`06-documents.png`). No branded summary, no score trend, no "resolved this month" list.
- **Expected:** `docs/gtm/ICP.md` says why firms pay: "a sellable 'inspection-ready' service for their clients". The product must produce the deliverable the firm hands to its client each month.
- **Actual:** There is nothing to hand over except a screenshot or the per-company checklist.
- **Fix:** Monthly client report PDF (firm name, client score, trend, fixed items, open items, next 30 days). See spec F2. Use the firm's own name; no AI-generated faces or voices; no payments.

### P-8 Major (process dependency, known): All rules advisory, so no red alert can ever fire
- **Steps:** `docs/RULES_MATRIX.md`: "12 rules, 12 awaiting lawyer review". Demo company page shows only "Advisory" badges.
- **Expected/Actual:** Documented as a known blocker in `docs/INVESTOR_REQUESTS.md`, so it may score 0 as a duplicate; I list it because it gates every paid promise. The product needs a lawyer-verification workflow, not just a lawyer: a `verified_by`, `verified_on` and changelog on each rule, a visible "verified" mark, and a path from "advisory" to "red".
- **Fix:** Backlog #6 (S effort, mostly process).

### P-9 Minor: Demo load button shows "..." and the load takes tens of seconds
- **Steps:** Click "Load demo data" on an empty firm. After 6 s the button label is "…" with no explanation (seen in my first run); the companies appeared 30–50 s later.
- **Expected:** A named progress label ("Loading demo data…") and a pending state; a new prospect on a demo call will think it is frozen.
- **Fix:** Use the translated pending label from the `ActionForm` in `src/components/dashboard/` and `aria-busy`. (Related to ARENA defect 7: no feedback on actions.)

### P-10 Minor: Company page employee rows show contract type but no position or department
- **Steps:** Company page → Employees (`04-company.png`): name, contract type, dates.
- **Expected:** Firms recognise staff by position; with 40+ employees a list by name and date only is hard to scan, and the "Documents" page needs the same context to pick the right employee.
- **Fix:** Optional `position` text on contracts (no salary, keeps the data-minimisation promise in `docs/ARCHITECTURE.md`).

## 4. Ranked feature backlog (top 15)

Effort: S ≤ 3 days, M ≤ 2 weeks, L > 2 weeks. Risk: L = legal (needs lawyer verification), T = tech.

| # | Feature | User problem | Evidence | Value for a paying firm | Effort | Risk |
|---|---|---|---|---|---|---|
| 1 | **F1 Firm deadline inbox** (cross-client, filter, assignee) | "Which clients need action this week?" | P-3, PRD persona Anna | The daily-use screen; makes the dashboard a work tool | S–M | T low |
| 2 | **F2 Score history + monthly client report PDF** | Cannot prove improvement or hand clients a deliverable | P-2, P-7, METRICS | The thing the firm sells to its clients; also feeds our case studies | M | T low |
| 3 | **F3 E-contract (SRC) migration tracker** | Every client must move contracts to the digital system | P-4, EY/Chambers/KPMG alerts | Time-boxed pain with a deadline; strongest pilot hook | M | L (date), T low |
| 4 | **F4 Client (company-scoped) access + owner Telegram digest** | Clients want to see their own status | P-1, ICP secondary | Firm retains clients, SME channel opens, viral inside firm's portfolio | M | T medium (RLS) |
| 5 | **F5 Re-sync import + ArmSoft preset + saved mappings** | Monthly refresh; no duplicates; zero setup | P-5, ARENA defect 2 | Activation and retention | M | T low |
| 6 | **Rule verification workflow** (verified_by/on, changelog, red unlock) | Advisory-only product cannot alarm anyone | P-8 | Credibility; unlocks red alerts and the legal partnership | S | L |
| 7 | **Document register per employee** (contract, orders, acknowledgements, safety briefing: present / missing / expiry) | Inspector asks for papers, not data | P-6, HLIB scope | Covers what is checked on site; reuses PDFs already generated | M | L (list of required docs) |
| 8 | **Inspection-day pack** (one PDF/ZIP: company checklist, register, contract list) | Panic when a notice arrives | HLIB inspection orders (ILO) | Emotional hook for sales; trigger event in ICP | S (after 7) | L |
| 9 | **Finding assignee, comment, snooze with reason** | Two accountants share a client | P-3 | Team use; audit trail already exists | S | T low |
| 10 | **OSH briefing tracker** (dates of briefings, next due) | Safety is most-cited violation area | JAMnews, ECOLUR | Reaches construction and manufacturing clients | M | L |
| 11 | **Leave calendar + balance** (vacation schedule, balance per employee) | Annual-leave rules need balance not only records | `annual-leave-min` edge cases | Fewer false positives; natural monthly use | M | L |
| 12 | **New-law rule pipeline** (e.g. parental hour Art. 207.1, to verify) | Law changes; firms want to be told | HO-281-N, HO-364-N (to verify) | Retention: "we watch the Code for you" | S per rule | L |
| 13 | **Timesheet import → overtime and working-time rules** | Overtime is a classic violation | RULES_MATRIX "not implemented" | Deeper moat; needs timesheet export from clients | L | L + T |
| 14 | **Salary-aware checks** (minimum wage, severance, leave pay) | Money errors are what employees complain about | RULES_MATRIX; min wage 75,000 AMD (to verify) | Strong but needs salary data, consent, DPA change | L | L high |
| 15 | **"Talk to a lawyer" referral button** (outside the app, no payments) | Firm wants a second opinion on a finding | PLAYBOOK lawyer partner | Revenue-share channel; credibility | S | L (contract) |

Ordering logic: 1–5 make the firm use it weekly and prove value; 6 is cheap and unlocks trust; 7–8 widen coverage to what inspectors really ask; 9–12 grow usage; 13–14 are heavy and legally risky, so after pilots tell us what customers need.

## 5. Specs for the top 5

### F1. Firm deadline inbox (`/[locale]/app/inbox`)
**Screens**
- Table of open findings across all companies in the active firm. Columns: due date, company, employee, rule title, status chip (advisory/red), assignee. Default sort: due date ascending, overdue first.
- Filters: company (multi), window (overdue / 7 / 14 / 30 days), rule, assignee, status. Search by employee name.
- Row action: open company page at that finding; mark fixed; dismiss (same server actions as today).
- Dashboard card "Due in 7 days: N" linking here. Mobile 390 px: cards instead of table.

**Data model** (migration `…_inbox.sql`)
- `findings.assignee_id uuid null references auth.users`; trigger limits assignee to a member of the same org. Existing rule "users change only `status`" is relaxed to `status` and `assignee_id` for roles owner/accountant.
- No new tables. Read through the user's RLS client: no new service-role path.

**Rules:** none. Only displays rule output. Advisory findings keep the advisory badge and the "not legal advice" line.

**Acceptance criteria**
1. With 5 demo companies (≈ 32 findings) the inbox shows all open findings in one list, sorted by due date.
2. A viewer sees the list but has no fix/dismiss/assign buttons; a forged request is refused by RLS (add a case to `supabase/tests/rls_cross_tenant.sql`).
3. User from firm B never sees firm A's rows (live cross-tenant e2e like `tenancy.spec.ts`).
4. Filtering by window "7 days" shows only findings with `due_date <= today+7`; overdue ones appear in a separate group.
5. Assigning to a user outside the org fails with a localised error.
6. hy/ru/en strings in a new namespace registered in `src/i18n/request.ts`; Lighthouse a11y ≥ 95; no console errors.

### F2. Score history and monthly client report
**Screens**
- Company page: sparkline plus table "score by week" (last 12), and "Fixed this month / New this month".
- Firm dashboard: small trend arrow per company (▲ +6 since last month).
- Documents page: button "Client report (PDF)" per company and month. PDF content: firm name, company name, date, score and trend, fixed items, open items by due date, next-30-days list, the standard disclaimer. Armenian font as in existing PDFs.

**Data model**
- `score_snapshots(id, org_id, company_id, taken_on date, score int check (score between 0 and 100), open_total int, open_red int, rules_versions jsonb, primary key (company_id, taken_on))`, composite FK `(company_id, org_id)` to `companies`.
- RLS: select for members (and, after F4, for company members of that company); no insert/update/delete for users. Written by the nightly job with the service role (same pattern as findings).
- Backfill: none (history starts at deploy); the demo loader may seed 8 weekly points so the demo shows a trend (mark as demo).

**Rules:** the snapshot stores `rules_versions` so a score drop caused by a new rule version is explainable ("score changed because rule X v2 went live", not "you got worse").

**Acceptance criteria**
1. After the nightly run each company has exactly one snapshot per day (idempotent on re-run).
2. Cross-tenant attack on `score_snapshots` returns 0 rows; users cannot write (add to `rls_cross_tenant.sql`).
3. Report PDF opens in Armenian, Russian and English without missing glyphs; for a company with 0 findings it says so instead of printing an empty table.
4. A rule-version bump shows up as an annotation on the trend, not as an unexplained drop.
5. Report for a company in another firm returns 404 (same pattern as `/api/pdf/*`).
6. No salaries, birth dates or other personal data beyond employee names appear in the report.

### F3. E-contract (SRC) migration tracker
**Screens**
- Company page tab "E-contracts": progress bar "12 of 20 employees on the digital system", list with a status per employee: `not started`, `entered`, `signed by both`. Bulk action "mark selected as entered".
- Firm dashboard column or filter "e-contracts left".
- Inbox (F1) shows one reminder per company, not one finding per employee, once the date is verified.

**Data model**
- Add to `contracts`: `src_status text check (src_status in ('not_started','entered','signed')) default 'not_started'`, `src_updated_on date`. Migrate the current boolean (registered = true → `signed`). Keep the boolean column until the rule is rewritten, then drop in a later migration.
- Store the legal date in the rule file, not in code: `rules/src-registration.json` v2 gets `source_url` (the exact arlis.am link), `deadline_new_contracts`, `deadline_existing_contracts`, status `verified` only after the lawyer signs.

**Rules**
- v2 of `src-registration`: advisory until verified. Fires only when a deadline from the rule file is within N days and the contract is not `signed`. No "due today" without a verified date.
- **Open legal questions for the lawyer (blocking):** which date applies to new vs existing contracts (sources conflict: see section 2); whether a paper contract after the start date carries any liability; who may sign in the system; what changes for amendments and terminations.

**Acceptance criteria**
1. Import of 20 employees sets all to `not_started`; marking 12 as `signed` updates the bar to 12/20 and the company score.
2. With the rule unverified, no red state and the disclaimer is visible.
3. Changing the rule file's date (new version) changes findings at the next run without code changes (unit test with fixed `asOf`).
4. Viewer cannot change status; cross-tenant attempt fails.
5. No claim of SRC integration anywhere in the UI: copy says "your record of the status in the SRC system".

### F4. Company-scoped client access and owner digest
**Screens**
- Settings → Team → "Invite a client" form: email + company picker. The invitee sees a reduced app: one company, findings, timeline, documents they may download, language switcher, Telegram connect. No import, no other companies, no firm gauge.
- Company page (firm side): "Client access" list with remove.
- Telegram weekly digest goes to the client owner for their company only (1–3 "fix this" lines, as in the PRD).

**Data model**
- `company_members(org_id, company_id, user_id, role 'client_viewer', created_at, primary key (company_id, user_id))`, composite FK `(company_id, org_id)`.
- New helper `private.can_see_company(company_id)` = is firm member OR exists row in `company_members`. Update select policies on `companies`, `employees`, `contracts`, `leave_records`, `findings`, `score_snapshots` to use it. Writes stay firm-only.
- Invitations: extend `invitations` with `company_id null`; accepting an invitation with a company creates a `company_members` row, not a `memberships` row.

**Rules:** none. The legal disclaimer stays on every advisory finding shown to clients.

**Acceptance criteria (security first, since RLS is the product's promise)**
1. A client user querying `companies` through PostgREST gets exactly the invited company, and 0 rows for any other company of the same firm.
2. Client user cannot insert, update or delete anything except marking a finding "acknowledged" (if we add it) and cannot read `audit_log`, `memberships`, `invitations`.
3. Cross-tenant tests in `supabase/tests/rls_cross_tenant.sql` extended: client of firm A / company 1 cannot see company 2 of firm A or anything in firm B.
4. Removing client access takes effect on the next request.
5. Digest for a client contains only that company's findings; unit test with two companies.
6. Consent gate and DPA acceptance apply to client users too (`consent_records`).

### F5. Re-sync import, saved mappings, ArmSoft preset
**Screens**
- Import wizard step "Compare": after mapping, show counts New / Changed / Unchanged / Missing from file, with a table of changes (e.g. "contract end: 31.12.2026 → 31.03.2027"). "Missing from file" is never auto-deleted: the user chooses "mark contract ended on date" or "ignore".
- Step 1 shows "Use saved mapping: ArmSoft export (July)" when headers match.
- Rows with the same name and no birth date are flagged as "ambiguous" and require a manual choice (fixes ARENA defect 2).

**Data model**
- `import_mappings(id, org_id, company_id null, name, headers_hash, mapping jsonb, created_by, created_at)`; RLS owner/accountant. Audit trigger as on other tables.
- Match key stored on `employees.external_key text null` (the file's own employee code if present; otherwise name + birth date). Unique `(company_id, external_key)` where not null.
- `armsoftPreset` in `src/lib/import/presets.ts` filled from one real anonymised export (requested in `docs/INVESTOR_REQUESTS.md`; ask each pilot for theirs). Do not invent header names.

**Rules:** the rules engine reruns after commit (already does).

**Acceptance criteria**
1. Importing the same file twice yields 0 changes and 0 duplicates.
2. Changing one contract end date in the file and re-importing shows exactly one "Changed" row and updates only that contract.
3. Two people with the same name and no birth date are never merged silently.
4. A row missing from the file is never deleted without an explicit choice; the choice is audit-logged.
5. Saved mapping is reused when the header set is identical; cross-tenant read of `import_mappings` is blocked.
6. Preset only ships once a real ArmSoft file is in the test fixtures (anonymised); until then the empty preset stays and the docs say so.

## 6. Risks and what I would not build
- **Legal:** nothing in the backlog invents law. Any item marked L needs the lawyer first. Parental hour, e-contract dates and any new rule start as advisory.
- **Payments:** none. Pilot pricing stays a sales conversation (`docs/gtm/PRICING.md`). Note for the lead: Vercel Hobby is non-commercial and Supabase Free pauses after 7 days idle (both already in PRICING.md); both must change before the first invoice.
- **No AI chatbot for legal answers.** Not in the backlog. An "explain this finding" text must be a static, lawyer-written string per rule.
- **Do not add** salary or health data before a lawyer has reviewed the DPA (`docs/legal/DPA_DRAFT.md`); #13 and #14 depend on that.

## 7. Pitch for the first 10 pilot firms

Use after a warm intro or in a conversation that already started. One screen, one call. Do not quote fine amounts until verified.

### Русский (сообщение в Telegram или после звонка)

Здравствуйте, [Имя]. Я [Имя] из Tesuch.

Мы делаем простой сервис для бухгалтерских фирм, которые ведут кадры у клиентов. Вы загружаете список сотрудников (из ArmSoft или Excel), а сервис сам считает сроки: конец испытательного срока, окончание срочных договоров, уведомления, отпуска. По каждой компании видно оценку «пройдёт ли проверку» и что поправить в первую очередь. Все клиенты на одном экране, самые рискованные сверху.

Сейчас у всех на столе перенос трудовых договоров в электронную систему КГД, и даты там меняются. Мы делаем для этого учёт: по каждой компании видно, сколько договоров уже внесено, а сколько ещё нет.

Что важно знать честно:
• Это не юридическая консультация. Правила пока проверяет юрист, до этого все замечания помечены как «справочные», со ссылкой на статью.
• Мы храним только то, что нужно для проверок: без зарплат и паспортных данных.
• Бесплатно на 60 дней для первых 10 фирм. Взамен: 15 минут раз в неделю на обратную связь и честные «это не работает».

Предлагаю так: вы присылаете один обезличенный файл (или просто пустую таблицу вашего формата), я за 20 минут на звонке загружаю одного вашего клиента, и вы смотрите, что нашлось. Если пользы нет, на этом всё.

Когда вам удобно: завтра или в четверг?

### Հայերեն (հաղորդագրություն Telegram-ով կամ զրույցից հետո)

Բարև Ձեզ, [Անուն]։ [Անուն]-ն եմ «Տեսուչից»։

Մենք պարզ ծառայություն ենք պատրաստել հաշվապահական ընկերությունների համար, որոնք հաճախորդների կադրային գործն են վարում։ Բեռնում եք աշխատակիցների ցուցակը (ArmSoft-ից կամ Excel-ից), իսկ ծառայությունն ինքն է հաշվում ժամկետները՝ փորձաշրջանի ավարտը, որոշակի ժամկետով պայմանագրերի վերջը, ծանուցումները, արձակուրդները։ Յուրաքանչյուր ընկերության համար երևում է՝ կանցնի՞ արդյոք տեսչության ստուգումը, և ինչը պետք է շտկել առաջինը։ Բոլոր հաճախորդները՝ մեկ էկրանին, ամենառիսկայինը՝ վերևում։

Հիմա բոլորի սեղանին աշխատանքային պայմանագրերի՝ ՊԵԿ-ի էլեկտրոնային համակարգ փոխադրումն է, ընդ որում՝ ժամկետները փոխվում են։ Դրա համար հաշվառում ենք անում. յուրաքանչյուր ընկերության մոտ երևում է, թե քանի պայմանագիր է արդեն մուտքագրված, քանիսը՝ դեռ ոչ։

Անկեղծ պայմաններն այսպիսին են․
• Սա իրավաբանական խորհրդատվություն չէ։ Կանոնները դեռ ստուգում է իրավաբանը, մինչ այդ բոլոր նկատառումները նշված են որպես տեղեկատվական՝ հոդվածի հղումով։
• Պահում ենք միայն ստուգումների համար անհրաժեշտը՝ առանց աշխատավարձի և անձնագրային տվյալների։
• Առաջին 10 ընկերությանը՝ 60 օր անվճար։ Դրա դիմաց խնդրում ենք շաբաթական 15 րոպե կարծիքի համար, այդ թվում՝ «սա չի աշխատում» ասելու համար։

Առաջարկս այսպես է․ ուղարկեք մեկ անանուն ֆայլ (կամ ձեր ձևաչափի դատարկ աղյուսակ), ես 20 րոպեանոց զանգի ընթացքում մեկ հաճախորդի տվյալները բեռնեմ, և դուք տեսնեք, թե ինչ է գտնվել։ Եթե օգուտ չկա, ապա դրանով ամեն ինչ ավարտվում է։

Ե՞րբ է Ձեզ հարմար՝ վաղը, թե հինգշաբթի։

### Questions to ask in the first call (feeds pricing and the backlog)
1. How many client companies do you run HR for, and what do you charge one client per month for HR paperwork? (price anchor, **to measure**)
2. Which system holds staff data (ArmSoft, 1C, Excel) and can you send an anonymised export? (unblocks F5)
3. Has any client had an inspection? What did the inspector ask for? (unblocks F7/F8/P-6)
4. How many clients have already moved contracts into the SRC system? (sizes F3)
5. Would you show the client their own score? Would the client want Telegram? (validates F4)
6. Does ArmSoft or another tool already remind you about deadlines? (confirms the competitive gap)

## 8. Method notes and limits
- Fetching full pages failed for several law-firm and news hosts (network allowlist), so legal dates and statistics come from search summaries and are all **to verify**. No fine amount is quoted anywhere in this report on purpose.
- The app was exercised as the owner of one throwaway firm in English. I did not test Armenian or Russian UI, mobile layout, Telegram delivery or PDF contents; other fighters cover those.
- Cleanup: the throwaway user was deleted, and the two orgs it created were deleted with the service role afterwards. Four other `qa-e-*` users exist from other fighters' runs; I left them alone.
