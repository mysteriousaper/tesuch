# QA war: results

_Judged 2026-11-19 on `main` @ `ac0091d`. Reports read: `docs/qa/{accountant,owner,breaker,polish,product}.md` with their evidence (`docs/qa/shots/*`, `docs/qa/breaker/*-output.txt`, helper scripts). Known items in `docs/ARENA.md`, `docs/SECURITY_REVIEW.md`, `docs/guide/PROPOSED_FIXES.md`, `docs/legal/LAWYER_CHECKLIST.md` and `docs/INVESTOR_REQUESTS.md` score 0. The app was not run by the judge. The most severe claims were checked against the code (see "Spot checks")._

## Scoring rules applied
- Points per `WAR_RULES.md`: critical 10, major 5, minor 2, ×1.5 when the fix names a file (and line) and the exact change.
- **Cross-fighter duplicates:** the points of one gap are split equally between the fighters who found it independently, each with their own evidence.
- The judge re-rated three items: sign-in lockout (B-5, O-5) **up** to critical (the rules list "lockout" as critical); accountant M5 (dashboard search) **down** to minor (the firm inbox in M-17 covers the need); product P-9 (demo feedback) merged into polish P-2 as a major.
- Configuration findings (Supabase Auth settings) cannot be confirmed from the repo. They are accepted on the fighters' read-only API output and marked area `owner`.

## Leaderboard

| Rank | Fighter | Points | Critical | Major | Minor | Rejected | Justification |
|---|---|---|---|---|---|---|---|
| 1 | accountant | **132** | 2 | 14 | 8 | 0 | Real firm-scale data (1170 staff, messy files) found the 1000-row cap and the import false-positive flood, both confirmed in code. Precise fixes throughout. |
| 2 | owner | **58.5** | 1 | 5 | 7 | 2 | Found real rule-engine logic bugs (expired contracts vanish, info shown as advisory, both confirmed) and the sign-in mail limit. Two items were already known. |
| 3 | breaker | **57** | 2 | 3 | 4 | 0 | The only cross-tenant hole (forced membership), proven live and on Postgres with exact SQL. Every claim has a BROKE line in the output files. |
| 4 | polish | **49.75** | 0 | 2 | 14 | 0 | A wide, careful sweep (570 page loads, contrast math, Lighthouse). One real WCAG fail on every form; the rest are small but precise. |
| 5 | product | **40.75** | 0 | 8 | 1 | 1 | Good market research and five strong specs. Most gaps were shared with the accountant, and the fixes point at specs, not code lines. |

Points per fighter (sum of the gaps below): accountant 30 (critical) + 60 (own majors) + 22.5 (shared majors) + 19.5 (minors); owner 7.5 + 35 + 16; breaker 22.5 + 22.5 + 12; polish 11.25 + 38.5; product 38.75 + 2.

**Rejected (0 points):** O-7 «հարց» for "finding" in bot/PDF (already in `docs/guide/PROPOSED_FIXES.md`); O-13 consent text has draft placeholders (already tracked in `docs/legal/LAWYER_CHECKLIST.md` items 15 and 26); product P-8 all rules advisory (known blocker in `docs/INVESTOR_REQUESTS.md`).

## Spot checks (code read)
| Claim | Result |
|---|---|
| B-1 forced membership | Confirmed. `memberships_owner_write ... for all` (`init.sql:286-288`) with no later migration dropping it. `userOrgs` orders by `created_at` (`queries.ts:20`). |
| A-C1 1000-row cap | Confirmed. `firmOverview` loads all open findings and all employees in one request each with no count or range (`queries.ts:44-46`). `run.ts:46-49` loads every finding of a company, fixed and dismissed included, with no paging. |
| A-C2 import false positives | Confirmed. `parseBool` "Empty means false" (`normalize.ts:74-76`); `annualLeaveShortfallDays` treats no leave records as 0 days taken (`facts.ts`); `src-registration` fires on `srcRegistered = false`. |
| O-1 expired contract vanishes | Confirmed. `isActive` is false once `endDate < asOf` (`facts.ts:25-27`); `fixed-term-ending` needs `isActive` and 0–30 days left. No rule covers an expired, unterminated contract. |
| O-6 info shown as advisory | Confirmed. `effectiveSeverity` returns `advisory` for every unverified rule (`engine.ts:13-15`). |
| B-3 erasure keeps PII | Confirmed. `private.audit()` stores `to_jsonb(old/new)` for `employees` (`init.sql:217-240`). |
| B-4 lead cap | Confirmed. Global `>= 30` per hour (`20261119010000_leads_throttle.sql:35`). |
| B-7 consent gate | Confirmed. `hasCurrentConsent` is used only in `app/layout.tsx:21`. |
| O-8 SRC checkbox | Confirmed. `defaultChecked={name === "src_registered"}` (`dashboard-forms.tsx:94`). |
| A-M8 / A-M9 import | Confirmed. `toTable` takes the first non-empty row (`parse.ts:17`); CSV read with `file.text()` (`import-wizard.tsx:48`). |
| A-M7 company edit | Confirmed. `actions.ts` exports no update/delete for companies. |
| O-15 digest | Confirmed. Monday digest only when `r.computed.length` (`nightly/route.ts:45`). |
| P-1 (polish) contrast | Confirmed token `--line: light-dark(#dad5c8, #2a3854)` (`globals.css:26`). |
| B-2, B-5, B-9, O-5 Auth config | Not verifiable from the repo. Accepted on the read-only Management API output in the reports and `breaker/p5-output.txt`. |

## Accepted gaps

Source ids: A = accountant (C1, M1…, m1…), O = owner, B = breaker, Po = polish, Pr = product.

### Critical

| Id | Title | Sources | Files | Fix |
|---|---|---|---|---|
| C-1 | An owner can insert a membership for any user (any role, backdated) and capture that user's data in a look-alike org | B-1 | `supabase/migrations/20261118000000_init.sql:286-288`, `src/components/dashboard/queries.ts:20` | New migration: drop `memberships_owner_write`, revoke insert/update, grant `update (role)`, owner-only update policy, delete policy for owners or self; DB test that an owner cannot insert another user's membership. |
| C-2 | Dashboard head count, open count and score silently truncated at 1000 rows; rule runs read truncated sets | A-C1 | `src/components/dashboard/queries.ts:44-46`, `src/lib/jobs/run.ts:46-49` | Grouped count RPC (or `count: "exact", head: true` per company) for the dashboard; page `run.ts` reads with `.range()` until fewer than 1000 rows, and load only open findings plus keys needed by `planSync`; unit test with 1001 rows. |
| C-3 | First import floods companies with findings for data the file cannot carry (79 % of 475), score 0 | A-C2 | `src/lib/import/normalize.ts:74-76`, `src/lib/import/pipeline.ts:50,74`, `src/lib/import/fields.ts`, `src/lib/rules/facts.ts`, `rules/annual-leave-min.json`, `rules/src-registration.json`, `rules/fixed-term-ground.json`, `src/components/import/import-wizard.tsx` | Tri-state (`null` = unknown) for `src_registered` and the fixed-term ground; rules skip unknown; `annual-leave-min` skips employees with no leave records (report as info); preview lists unmapped optional fields and their impact; add leave columns to the import. |
| C-4 | Anyone can lock all users out of sign-in: 30 emails per hour project-wide, no CAPTCHA, OTP-only login | B-5, O-5 | Supabase Auth settings, `src/app/[locale]/login/login-form.tsx:24` | Enable Turnstile/hCaptcha and pass `captchaToken`; move auth mail to a real SMTP provider (Resend, verified domain) and raise `rate_limit_email_sent`; show a localized "too many requests" message on 429. |

### Major

| Id | Title | Sources | Files | Fix |
|---|---|---|---|---|
| M-1 | Auth redirect allow-list wildcard matches any Vercel project name; recovery/invite emails can send a session to an attacker | B-2 | Supabase Auth URL configuration, email templates | Exact hosts only; remove `{{ .ConfirmationURL }}` from recovery and invite templates; document in `docs/RUNBOOK.md`. |
| M-2 | "Erase for good" leaves the employee's name and birth date in `audit_log`; audit rows outlive the org | B-3 | `supabase/migrations/20261118000000_init.sql:217-240,315`, `src/app/[locale]/app/members/actions.ts:111` | Strip personal columns in `private.audit()` (or null them on employee delete); FK `audit_log.org_id` → `orgs` on delete cascade; retention confirmed by the lawyer. |
| M-3 | 30 junk leads per hour close the free self-check lead form for everyone | B-4 | `supabase/migrations/20261119010000_leads_throttle.sql:35`, `src/app/[locale]/check/actions.ts:28` | Per-IP-hash throttle (3 per hour) passed to `submit_lead`; raise the global cap to about 500; honeypot field. |
| M-4 | An expired fixed-term contract (or ended probation) with no termination produces no finding; "ending soon" auto-resolves to fixed | O-1 | `src/lib/rules/facts.ts:25-27`, `rules/fixed-term-ending.json`, `src/lib/rules/engine.ts` (`planSync`) | New advisory rule `fixed-term-expired` with a `hasSuccessorContract` fact; do not auto-resolve `fixed-term-ending` because `isActive` flipped. |
| M-5 | Reminder (info) rules are shown as "Advisory", cost 4 points and push alerts | O-6 | `src/lib/rules/engine.ts:13-15` | `return rule.severity === "info" ? "info" : rule.status === "verified" ? rule.severity : "advisory";` plus unit test. |
| M-6 | A company with no employees shows a green 100 ("Keep it up"), inflating the firm average and the PDF | A-M2, O-2 | `src/components/dashboard/queries.ts:58`, `src/components/dashboard/company-list.tsx`, `src/app/[locale]/app/companies/[id]/page.tsx`, `src/lib/notify/i18n.ts:48` | `score: null` when staff is 0, excluded from `firmScore`; "No data yet" with an "Add or import staff" CTA in UI, PDF and bot. |
| M-7 | The score is not comparable or explained: flat 4 points per advisory finding (any 25 findings = 0, three likely breaches still green 88) | A-M1, O-2 | `src/lib/rules/score.ts:4-9`, `src/lib/notify/commands.ts` (`scoreIcon`), `src/app/[locale]/app/page.tsx` | Normalise by head count or cap the penalty; any open finding caps the icon below green; "How is this scored?" popover from `docs/DECISIONS.md` row 8; show findings count next to score. |
| M-8 | The legal disclaimer is missing on the dashboard and buried under the findings list on the company page | A-M3 | `src/components/dashboard/finding-list.tsx:84-87`, `src/app/[locale]/app/page.tsx:48`, `src/app/[locale]/app/companies/[id]/page.tsx` | Render the disclaimer under each `ScoreGauge` (or once under the app nav). |
| M-9 | Company page is one flat list of every finding (475 cards, 606 KB HTML), no grouping, filter or paging; no employee search | A-M4 | `src/app/[locale]/app/companies/[id]/page.tsx:26,61`, `src/components/dashboard/finding-list.tsx` | Group by rule with counts, `?rule=&type=&q=` filters, page at 50, employee search box. |
| M-10 | A company cannot be renamed, edited, archived or deleted; demo companies cannot be removed; demo button stays | A-M7 | `src/app/[locale]/app/actions.ts`, `src/app/[locale]/app/companies/[id]/page.tsx` | `updateCompany` / `archiveCompany` / `deleteCompany` (owner only, `editableCompany` pattern) and a settings block; hide demo button when demo exists. |
| M-11 | Files with title rows above the header cannot be imported, with no explanation | A-M8 | `src/lib/import/parse.ts:17-26`, `src/components/import/import-wizard.tsx` | Detect the header as the first row with ≥ 2 alias matches in the first 20 rows; "Header row" input that re-runs `toTable`. |
| M-12 | Windows-1251 CSV (Excel default in Russian locale) imports as mojibake | A-M9 | `src/components/import/import-wizard.tsx:48` | Read `arrayBuffer()`, decode UTF-8 with `fatal: true`, fall back to `windows-1251`, show and allow switching the encoding. |
| M-13 | Re-importing an updated export never updates existing employees; preview counts duplicates as "ready"; ArmSoft preset empty | A-M10, Pr-5 | `src/app/[locale]/app/import/actions.ts`, `src/lib/import/presets.ts:8` | Upsert on `(company_id, external_ref)` with a New/Changed/Unchanged preview; saved mappings per firm; ArmSoft preset from a real anonymised file (spec F5). |
| M-14 | No bulk actions on findings and no reason stored on dismiss | A-M11 | `src/components/dashboard/finding-list.tsx`, `src/app/[locale]/app/actions.ts:169`, new migration | Checkboxes + "apply to selected" (and "all of this rule"); required `dismissed_reason` column. |
| M-15 | Audit log shows raw UUIDs and is buried by system finding rows | A-M12 | `src/app/[locale]/app/audit/page.tsx` | Hide system `findings` rows by default with a toggle; join entity names; render changed keys from old/new JSON. |
| M-16 | Documents page offers probation orders for ended probations and dismissed staff; 456 links, no filter; UUID file names | A-M13 | `src/components/documents/contract-docs.tsx`, `src/app/api/pdf/_lib/load.ts` (`pdfResponse`) | Show probation orders only near probation end and when not terminated; name filter; slug of employee name in `Content-Disposition`. |
| M-17 | No firm-wide "what is due this week" view across clients | A-M14, Pr-3 | new `src/app/[locale]/app/inbox/**`, migration for `findings.assignee_id` | Firm deadline inbox (spec F1): open findings and contract dates across companies, filters, assignee, `.ics` export. |
| M-18 | No client-facing report or Excel export; the checklist PDF is an unsorted 40-page table | A-M6, Pr-7 | `src/lib/pdf/documents.ts`, new `src/app/api/export/**` | Monthly client report PDF (spec F2), XLSX export of findings, PDF rows sorted by employee then rule with a summary page. |
| M-19 | No company-scoped access: a viewer or accountant sees every client of the firm | A-M15, Pr-1 | `supabase/migrations/20261118000000_init.sql` (RLS), `20261119020000_members.sql` | `company_members` + `private.can_see_company()` and RLS updates; invitations with `company_id` (spec F4). |
| M-20 | No score history, so the product cannot prove improvement (pilot metric unmeasurable) | Pr-2 | `src/app/api/jobs/nightly/route.ts`, new migration | `score_snapshots` written by the nightly job; sparkline on company page; trend on dashboard (spec F2). |
| M-21 | SRC e-contract is a single boolean that fires "due today" with an unverified date | Pr-4 | `rules/src-registration.json`, `src/lib/rules/engine.ts` (`due.date = asOf`) | Lawyer confirms dates; `src_status` tracker per contract; no "due today" for rules without a verified date (spec F3). |
| M-22 | Nothing covers occupational health and safety, where inspectors find most violations | Pr-6 | `rules/`, product copy | Lawyer-written document-presence checklist (advisory); consider renaming the score to "labour-contract readiness" until OSH exists. |
| M-23 | An SME owner is forced to create an "accounting firm" and then add the same company again | O-3 | `src/app/[locale]/app/actions.ts:77` (`createOrg`), org setup UI, `src/lib/notify/commands.ts` | First-step choice "one company / accounting firm"; for `kind = company` auto-create the single company and drop firm wording. |
| M-24 | Alerts and digests say what is wrong but not what to do, and link only to the arlis.am home page | O-4 | `src/lib/notify/messages.ts` (`line()`), `rules/*.json` | Per-rule `action` text (hy/ru/en, lawyer-reviewed), app link to the company, PDF link where a template exists, company name once per block, settings link in email footer. |
| M-25 | Input and outlined-button borders have 1.4:1 contrast (WCAG 1.4.11 fail) on every form | Po-1 | `src/app/globals.css:26,45,64`, `src/components/dashboard/action-form.tsx:7,10`, `src/components/members/forms.tsx:10,12`, `src/components/dashboard/finding-actions.tsx:10`, `src/components/import/import-wizard.tsx:26` | New `--control` token (≥ 3:1) per theme used for inputs and outlined buttons; add to `tokens.test.ts`. |
| M-26 | "Load demo data" takes 15–50 s with only "…" as feedback | Po-2, Pr-9 | `src/components/dashboard/*` (demo button), `src/app/[locale]/app/actions.ts:115` | Translated pending text and `role="status"`; batch inserts per table; `maxDuration` on the route segment. |

### Minor

| Id | Title | Sources | Files | Fix |
|---|---|---|---|---|
| m-1 | Consent gate only in the `/app` layout: API, PDFs, exports and actions work without consent; client chooses `ip_hash` | B-7 | `src/app/[locale]/app/layout.tsx:21`, `src/app/api/pdf/_lib/load.ts:19`, `members/data/export/route.ts`, `supabase/migrations/20261119030000_consent.sql:25` | `private.has_consent()` in write policies and `create_org()`; check consent in route handlers; grant insert without `ip_hash`, set it on the server. |
| m-2 | Invitations stay valid after the inviting owner is demoted or removed | B-6 | `supabase/migrations/20261119020000_members.sql:61-79` | Check the inviter is still owner in `accept_invitation`; delete their open invitations on demotion/removal. |
| m-3 | No Content-Security-Policy header | B-8 | `next.config.ts:14-20` | Add CSP with a hash for `MODE_SCRIPT`, report-only for a week first. |
| m-4 | Production Auth `site_url` is `http://localhost:3000` | B-9 (O-5) | Supabase Auth settings | Set to the production origin. |
| m-5 | Mobile app nav cuts off Team / Audit / Settings with no scroll cue | A-m7, O-14, Po-3 | `src/app/[locale]/app/app-nav.tsx:21` | Edge fade + scroll-snap (or wrap/"More" menu), scroll active tab into view. |
| m-6 | Dashboard has no search or filter; company pickers do not remember the last client | A-M5 | `src/components/dashboard/company-list.tsx`, import/documents/quiz pages | Client-side filter + score chip; last-company cookie used to preselect. |
| m-7 | Duplicate companies (same name or tax id) accepted silently | A-m1 | `src/app/[locale]/app/actions.ts:102-113`, new migration | Unique `(org_id, tax_id)` where not null; friendly error. |
| m-8 | hy audit intro glues `-ի` to the firm name | A-m2 | `messages/hy/audit.json:4` | Rephrase so the name stands alone. |
| m-9 | Findings called "Нарушения/Violations" in audit and members texts; quiz has three names | A-m3, Po-15 | `messages/*/audit.json`, `messages/*/members.json`, `messages/*/quiz.json` | Use «Проблемы/Issues», «Շաբաթական վիկտորինա / Еженедельная викторина» per glossary. |
| m-10 | Viewer sees an "Add company" CTA they cannot use | A-m4 | `src/app/[locale]/app/import/page.tsx` | Hide for viewers; say who can add. |
| m-11 | Header open count not refreshed after "Check now" | A-m5 | `src/app/[locale]/app/actions.ts:152` | `revalidatePath` the company page and refresh the router. |
| m-12 | Quiz asks the accountant to pick a client with no explanation of what the streak applies to | A-m6 | `src/app/[locale]/app/quiz/**`, `messages/*/quiz.json` | Explain scope in the intro or make the quiz firm-level. |
| m-13 | "Registered on SRC" checkbox ticked by default, silencing its rule | O-8 | `src/components/dashboard/dashboard-forms.tsx:94` | No default; tri-state with C-3. |
| m-14 | Self-check mixes question polarity; Q4 asks two things | O-9 | `src/app/[locale]/check/questions.ts`, `messages/*/check.json` | Phrase all questions positively; split Q4. |
| m-15 | Self-check result: over-strong verdict, no sign-up CTA, no "what to do" | O-10 | `messages/*/check.json` (`result.bands.low.d`), `src/app/[locale]/check/**` | Soften copy; add "Create a free account"; one-line action per item. |
| m-16 | Quiz shows a streak mid-week at 2/5; unverified rule taught as fact | O-11 | `src/components/quiz/streak-panel.tsx`, `src/lib/quiz/**` | "Pending until Sunday"; minimum score; mark unverified items advisory. |
| m-17 | Dismissal-notice PDF spills onto a near-empty page; English footer in hy document | O-12 | `src/lib/pdf/documents.ts` | `wrap={false}` on the signature block; localize the footer. |
| m-18 | No notification preferences; clean companies never get a Monday digest | O-15 | `src/app/api/jobs/nightly/route.ts:45`, settings page | Always send an "all clear" digest; per-channel toggles. |
| m-19 | Locked quiz badges fail contrast (2.2:1) | Po-4 | `src/components/quiz/streak-panel.tsx:34` | Drop `opacity-50`; dashed border + "Locked" word. |
| m-20 | /themes "Option N" label 3.6:1 | Po-5 | `src/components/theme-preview.tsx:41` | Use `text-muted` or darken `--highlight` for small text. |
| m-21 | Targets under 24 px (Sign out, footer links, back links) | Po-6 | `src/app/[locale]/app/layout.tsx:33`, `src/components/landing/site-footer.tsx:27` | `py-2` / `min-h-6`. |
| m-22 | No skip link | Po-7 | both layouts, `messages/*/common.json` | Visually hidden "Skip to content" + `id="main"`. |
| m-23 | Armenian set in uppercase with letter-spacing | Po-8 | `src/app/[locale]/check/page.tsx:29`, `src/app/[locale]/page.tsx:38`, `src/app/[locale]/app/audit/page.tsx:92`, `src/app/[locale]/not-found.tsx` | `[lang=hy]:normal-case [lang=hy]:tracking-normal`. |
| m-24 | Decorative glyphs (⬇, 🔥) read by screen readers | Po-9 | `src/components/documents/contract-docs.tsx:31-45`, `src/components/import/import-wizard.tsx:184`, `src/components/quiz/streak-panel.tsx:4,18` | Wrap in `<span aria-hidden>`. |
| m-25 | Landing hero mock truncates rule titles; stat wraps | Po-10 | `src/components/landing/hero-mock.tsx:69`, `src/app/[locale]/page.tsx:101-106` | `line-clamp-2`; `whitespace-nowrap` on the value. |
| m-26 | Footer prints "Tesuch" in hy and ru | Po-11 | `src/components/landing/site-footer.tsx:20` | Use `common.appName`. |
| m-27 | Login: no way to change the e-mail after sending the code | Po-12 | `src/app/[locale]/login/login-form.tsx`, `messages/*/auth.json` | "Use another e-mail" link back to step 1. |
| m-28 | /login has no meta description | Po-13 | `src/app/[locale]/login/page.tsx`, `messages/*/auth.json` | Add localized `description`. |
| m-29 | Checklist PDF typography in hy (ASCII colons, narrow basis column, footer wrap) | Po-14 | `src/lib/pdf/documents.ts:264-266` | `՝` labels; wider basis column; shorter hy footer. |
| m-30 | hy «Ձեր/Դուք» capitalised, «ընկերություն» for firm; "Supabase" shown to users | Po-16 | `messages/hy/members.json`, `messages/hy/errors.json`, `messages/*/auth.json` | Apply the polish language-fix table. |
| m-31 | Employee rows show no position, hard to scan at 40+ staff | Pr-10 | `src/app/[locale]/app/companies/[id]/page.tsx`, contracts migration | Optional `position` text on contracts. |

**Totals:** 4 critical, 26 major, 31 minor (61 gaps), plus 5 features.

## Top product features (from `product.md`, judge verdict)

| # | Feature | Verdict |
|---|---|---|
| F1 | Firm deadline inbox (cross-client, filters, assignee) | **Build first.** It answers the accountant's daily question, closes M-17 and part of M-14, and needs only one column (`assignee_id`) and no service-role path. Depends on C-2 being fixed (counts must not truncate). |
| F2 | Score history + monthly client report PDF | **Build, after M-6 and M-7.** A trend of a misleading score is worse than none: fix the score model and the empty-company 100 first. Closes M-18 and M-20. |
| F3 | E-contract (SRC) migration tracker | **Build the tracker now, keep the rule advisory.** The status column and progress bar need no law; the deadline must wait for the lawyer. Also fixes C-3's SRC part and M-21. |
| F4 | Company-scoped client access + owner digest | **Build, security-first.** Highest RLS risk; do it after C-1 is fixed and with the cross-tenant tests in the spec. Closes M-19 and opens the SME channel (with M-23 and M-24). |
| F5 | Re-sync import + saved mappings + ArmSoft preset | **Build re-sync and saved mappings now; ship the preset only with a real anonymised file.** Combine with M-11, M-12 and C-3 so import survives real files. |
