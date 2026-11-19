# QA war: fighter "owner"

Persona: owner of a 25-person Armenian SME. Not a lawyer, lives in Telegram.

Tested on a local production build (`pnpm build && pnpm start -p 3302`) against the real Supabase project, in real Chromium (Playwright, 390 px unless noted, locale `hy`). Throwaway user, one lead row and the Telegram-link rows were deleted afterwards (verified: 0 memberships, 0 orgs, 0 leads left). No bot token and no Resend key were configured, so nothing was sent anywhere.

Method notes
- Browser flow: landing → `/hy/check` → lead → login (OTP stubbed like `tests/e2e/helpers/auth.ts`) → consent → create firm → add company → add 3 employees → findings → documents/PDFs → quiz → settings.
- Telegram: `handleUpdate` driven with crafted updates against the real DB (`owner-scripts/bot.ts`). Messages: `owner-scripts/msg.ts`. Rule run: `owner-scripts/job.ts` (`runRulesForCompany` on my own company only; I did **not** call the nightly route, because it processes every company in the shared project, including other fighters' data).
- Run the scripts with `NODE_OPTIONS=--conditions=react-server NODE_USE_ENV_PROXY=1 npx tsx docs/qa/owner-scripts/<name>.ts`.
- Screenshots: `docs/qa/shots/owner/` (26 PNG, 1x).

## Counts

| Severity | Count |
|---|---|
| Critical (10) | 0 |
| Major (5) | 6 |
| Minor (2) | 9 |

## Findings, most severe first

### O-1 · Major · Expired fixed-term contract produces no finding, and the "ending soon" finding silently turns into "fixed"
- **Steps:** Add an employee with a fixed-term contract ending in 12 days (finding `fixed-term-ending` opens). Change the end date to 5 days ago, with no termination recorded (the employee is still working). Run "Ստուգել հիմա" / `runRulesForCompany`.
- **Expected:** The most common real-world trap should be the loudest finding: a fixed-term contract that ran out while the person kept working. An owner needs "contract ended on X, the employee still works: decide now".
- **Actual:** `autoRes 1`, score goes **88 → 92**, no new finding. `isActive` is false once `end_date < asOf` (`src/lib/rules/facts.ts:25-27`), and `fixed-term-ending` only fires for 0–30 days *before* the end (`rules/fixed-term-ending.json`). So the finding disappears (status `fixed`) exactly when the risk begins. The same happens for a probation that has ended (see `job.ts` output: probation ended 9 days ago → no finding).
- **Evidence:** `owner-scripts/job.ts` output:
  `fixed-term ended 5 days ago, no termination 565ms ins 0 upd 0 reopen 0 autoRes 1 score 92 probation-max:advisory,fixed-term-ground:advisory`
- **Fix:** Add a rule (e.g. `fixed-term-expired`, scope contract, severity amber) with conditions `isFixedTerm = true`, `terminated = false`, `daysUntilContractEnd < 0`, no later contract for the same employee. Needs a fact `hasSuccessorContract` in `src/lib/rules/facts.ts`. The wording should say "contract ended, employee still active" and leave the legal consequence to the lawyer. Also make `planSync` not auto-resolve `fixed-term-ending` because of `isActive` flipping to false: the user has to confirm.

### O-2 · Major · The score is misleading in both directions: empty company = 100 "Keep it up", three likely violations = 88 / 🟢
- **Steps:** (a) Create a company and add no employees. (b) Add 2 staff with a probation over 3 months and a fixed-term contract without a stated ground.
- **Expected:** (a) "No data yet, add staff to get a score". (b) A company with a probable probation breach and an unfounded fixed-term contract must not look green.
- **Actual:** (a) Company page shows **100** "Ստուգման պատրաստվածություն" and "Բաց խնդիր չկա։ Այսպես էլ պահեք։" ("No open issues. Keep it up.") for 0 employees (`15-company-empty-390.png`). The dashboard says "0 աշխատող · Խնդիր չկա". (b) Score **88**, 🟢 in the bot (`scoreIcon(s>=80)`, `commands.ts` ~`scoreIcon`), because an unverified rule is "advisory" and costs only 4 points (`src/lib/rules/score.ts:4`). Three findings are 12 points. The Telegram `/status` line: `1. 🟢 Կարեն Ավտո ՍՊԸ — 88/100 · Բաց հարցեր: 3`.
- **Evidence:** `15-company-empty-390.png`, `18-company-findings-390.png`, bot output in `owner-scripts/bot.ts` run.
- **Fix:** (1) `companies/[id]/page.tsx` and dashboard: when `employees = 0`, show "—" and a CTA "Add or import staff" instead of 100 and "Keep it up". `scoreIcon` in `commands.ts` and the app gauge should take the number of open findings into account: any open finding caps the icon at 🟠 and the score at 89. (2) Or count advisory findings of "red" rules at their real weight in the displayed score and label the number "provisional" until the rules are verified.

### O-3 · Major · An SME owner is forced to be an "accounting firm"
- **Steps:** New user signs in → `/hy/app` asks only "Ստեղծեք ձեր ֆիրման / Ֆիրմայի անվանումը" (`12-create-org-390.png`). Then the owner must also "Ավելացնել ընկերություն" inside the firm, which is the same business twice. Check `orgs.kind` in the DB.
- **Expected:** An owner of one company chooses "I run one company" and lands on a single-company view.
- **Actual:** `orgs.kind = accounting_firm` for every self-signup (queried with the service role). Telegram `/status` then says "🏢 Կարեն Ավտո ՍՊԸ · Հաշվապահական ընկերություն — Միջին միավոր: 88/100" followed by the same name again as company no. 1. The org settings say "Ֆիրմա". The landing's whole second half speaks to accounting firms, so the owner persona in the PRD (Karen) has no path of their own.
- **Evidence:** `12-create-org-390.png`, `13-empty-dashboard-390.png`; DB query output `{"kind":"accounting_firm","name":"Կարեն Ավտո ՍՊԸ"}`; bot `/status` text.
- **Fix:** Add a first-step choice ("Ես ղեկավարում եմ մեկ ընկերություն" / "Ես հաշվապահական ֆիրմա եմ") in the create-org action (`orgs.kind` already allows `company`) and, for `company`, auto-create the single company with the same name and skip the "firm" wording. `commands.ts` already has the `company` kind label, so the bot only needs the data.

### O-4 · Major · Alerts and the digest never say what to do or link back to the app
- **Steps:** Render `telegramAlert`, `telegramDigest`, `emailAlert`, `emailDigest` in hy/ru/en (`owner-scripts/msg.ts`).
- **Expected:** "Probation of Anahit ends in 3 days: decide, then [open the order template]". A link to the company in Tesuch and a way to switch email off.
- **Actual:** Every message is: icon, rule title, company · employee, "Ժամկետ: 01.12.2026", article citation, and a link `https://www.arlis.am/`, which is the **home page** of arlis.am, not the article (`rules/*.json` `source_url`). There is no action, no app link, no PDF link, and the email has no "turn this off" note. The same company name is repeated on every line of a one-company digest. For a non-lawyer the message tells *that* something is wrong, never *what to do*.
- **Evidence:** `msg.ts` output, e.g. hy alert:
  `🟡 Նախազգուշական: Որոշակի ժամկետով պայմանագիրը շուտով ավարտվում է / Կարեն Ավտո ՍՊԸ · Գևորգ Պետրոսյան / Ժամկետ: 01.12.2026 / ՀՀ աշխատանքային օրենսգիրք, հոդված 95 (...) · arlis.am`; `links in html: ['https://www.arlis.am/', ...]`.
- **Fix:** In `src/lib/notify/messages.ts` `line()` add `next` (one short sentence per rule, in `rules/*.json` under a new `action` field in hy/ru/en) and an `appUrl` (`${SITE}/${locale}/app/companies/${companyId}`). Print the app link and "Ստուգաթերթ (PDF)" link when the rule has a template. Print the company name once per digest block. Add "Settings → notifications" in the email footer.

### O-5 · Major · Production sign-in email: Gmail SMTP with a project-wide limit of 30 mails per hour
- **Steps:** `GET /v1/projects/<ref>/config/auth` (read-only, via the proxy).
- **Expected:** A sender domain and a limit that survives a launch day with many owners signing in at the same time.
- **Actual:** `smtp_host = smtp.gmail.com`, `smtp_admin_email = tesuch.app@gmail.com`, `rate_limit_email_sent = 30` (per hour, whole project), `mailer_otp_length = 8`, `site_url = http://localhost:3000`. Sign-in is passwordless-OTP-only (`/hy/login`), so the 31st person in any hour cannot sign in at all (lockout on the main flow), and a free Gmail account as a sender is a deliverability and daily-cap risk. The code is 8 digits, which is long for a phone user typing from another app.
- **Evidence:** config values above (no secrets printed); `owner-scripts/flow.ts` shows the stubbed OTP flow, which hides this limit.
- **Fix:** Move auth mail to Resend (already planned for alerts) with a verified domain, raise `rate_limit_email_sent`, set `site_url` to the production origin, consider `mailer_otp_length = 6`. In `src/app/[locale]/login`, show a clear "too many requests, try in N minutes" message on a 429 from `signInWithOtp`.

### O-6 · Major · "Reminder" findings are shown as "Advisory" and cost score points
- **Steps:** Add a fixed-term contract that ends within 30 days, or a probation ending within 14 days.
- **Expected:** `fixed-term-ending` and `probation-ending` are `severity: "info"` rules. Decision 8 says info costs 0, and the guide lists "Հիշեցում" (reminder, information) as its own type.
- **Actual:** `effectiveSeverity` returns `"advisory"` for **every** unverified rule, info included (`src/lib/rules/engine.ts:13-15`). The list showed "Նախազգուշական" for "Որոշակի ժամկետով պայմանագիրը շուտով ավարտվում է", score −4 (84 after the probation reminder, see job output `score 84`), and an alert is pushed (`run.ts`: `f.severity !== "info"` is false only for true info). So a plain heads-up looks like a legal problem.
- **Evidence:** `18-company-findings-390.png`; `job.ts` output `probation-ending:advisory,...`; `rules/fixed-term-ending.json` `"severity": "info"`.
- **Fix:** `engine.ts:13` → `return rule.severity === "info" ? "info" : rule.status === "verified" ? rule.severity : "advisory";`. Info rules are deadlines, not claims about the law, so they do not need the "unverified" downgrade.

### O-7 · Minor · "Տեսուչ" copy: "հարց" (question) is used for "finding" in the bot, PDF and help
- hy `/help`: "բաց հարցերը"; `/status`: "Բաց հարցեր: 3"; checklist PDF header "Հարց", "Բաց հարցեր: 4"; whereas the app and guide say "Խնդիրներ". "Հարց" means "question"; an owner reads "3 open questions" and wonders who asked. Also the score is "ցուցանիշ" in the app and guide, "միավոր" in the bot and PDF (`src/lib/notify/commands.ts` strings, `src/lib/notify/i18n.ts` `T.openFindings`, `T.score`, and the PDF strings). Evidence: bot output, `21-pdf-checklist.png`. Fix: use "խնդիր(ներ)" and "ցուցանիշ" everywhere in hy.

### O-8 · Minor · "Registered on SRC platform" is ticked by default, which silences its rule
- `src/components/dashboard/dashboard-forms.tsx:94` has `defaultChecked={name === "src_registered"}`, and the import template sample uses yes. The rule `src-registration` fires only when the flag is false, so a busy owner who never touches the checkbox will never get the finding. Evidence: form dump (`16-add-employee-form-390.png`, checkbox ticked). Fix: no default (tri-state "don't know / yes / no") and treat "don't know" as open advisory.

### O-9 · Minor · The self-check mixes question polarity and is compound in places
- Q1–Q2 and Q9 ask "Has it ever happened that you set a probation for a minor?" (Yes = bad), the others ask "Are all …?" (Yes = good), and Q4 asks two things at once ("do you track probation ends **and** notify 3 days before?"). Tapping "Այո" through all ten gives 70, "Ոչ" through all gives 30; the answer buttons are identical. Evidence: `owner-scripts` run, `04-check-q1-390.png`, `05-check-result-390.png`. Fix: phrase all ten positively ("Do all your fixed-term contracts state the ground?") and split Q4 in `src/app/[locale]/check/questions.ts` + `messages/*/check.json`.

### O-10 · Minor · Self-check result: scary verdict from self-reported answers, and no way forward
- Result band "Բարձր ռիսկ — Ստուգումը, ամենայն հավանականությամբ, խախտումներ կհայտնաբերի" ("An inspection will most probably find violations") is a strong statement for an unreviewed rule set and a 10-tap quiz. The result lists the law ("Why") but not the fix. The only link per item is `arlis.am` home. The page has no sign-up button; the single next step is leaving an email for a "pilot program" and the success text only says "we will contact you" (no email is sent; `07-lead-submitted-390.png`). Lead capture itself works (row stored with recomputed score 30, consent true). Fix: soften `check.result.bands.low.d` ("Մի քանի կետ արժե ստուգել…"), add a "Create a free account" CTA to `/login`, and a one-line "what to do" per item.

### O-11 · Minor · Quiz marks a week as a 1-week streak at 2/5, mid-week
- After answering 2 of 5 correctly the page says "🔥 1 շաբաթ" for both current and longest streak, while the week is not finished. The footer says the week counts if the quiz is *completed* and no overdue breach exists at the **end** of the week. Also the quiz teaches "contracts must be registered on the SRC e-platform" as a "correct answer" with source "հոդվածը ճշտվում է" (no article, rule unverified), which is a legal claim stated as fact. Evidence: `24-quiz-result-390.png`. Fix: show "pending until Sunday" for the current week; require ≥3/5 for a streak; mark unverified quiz items "advisory" like the rules.

### O-12 · Minor · Dismissal-notice PDF spills onto a second, almost empty page, with an English footer in an Armenian document
- hy notice: page 2 holds only "Ամսաթիվ՝ ________" and the footer; footer mixes hy with "DRAFT template — verify with a lawyer." (`src/components/documents`/`src/lib/pdf`). Evidence: `20-pdf-dismissal.png`, `22-pdf-dismissal-page2-2.png`. Fix: tighten spacing so the date line stays on page 1 (or add `wrap={false}` to the signature block), and localize the footer.

### O-13 · Minor · The consent gate shows unfinished legal text with placeholders to a new owner
- The gate says "Նախագիծ՝ իրավաբանի ստուգման փուլում … [քառակուսի փակագծերում] նշված ժամկետներն ու իրավական հղումները կարող են փոխվել". The first screen after sign-up tells a new user the terms are a draft and still contain bracketed blanks, which looks unfinished (and a legal risk for the company). Evidence: `10-consent-390.png`. Fix: finish the text before pilots, or hide the placeholder note from owners.

### O-14 · Minor · Mobile app navigation is cut off at 390 px without a hint
- The top tab bar shows "Վահանակ, Ներմուծում, Փաստաթղթեր, Վիկ…" and the remaining tabs (Team, Audit, Settings) are only reachable by sideways scroll with no fade or arrow (`18-company-findings-390.png`). Settings holds the Telegram button, which an owner needs on day 1. Fix: a "More" menu or a wrapping bar in `app-nav.tsx`.

### O-15 · Minor · No notification preferences
- Settings → Notifications has: connect Telegram, a test alert, and the account email. No way to switch email alerts or the weekly digest off, to add a second recipient (the HR person, a group), or to choose the weekday. Also a company with zero findings gets no Monday digest at all (`route.ts`: `if (monday && r.computed.length)`), so a clean owner never hears from the product and cannot tell it is alive. Evidence: `25-settings-390.png`, code read. Fix: always send the Monday digest with "✅ all clear, score N" and add per-channel toggles to the settings page.

## Verified OK (no finding)
- Landing hy/ru/en renders, no console errors, no horizontal overflow at 390 px (`01`, `02`).
- Self-check lead capture works end to end; consent unchecked is refused; score is recomputed on the server.
- Consent gate blocks the app until accepted; accepting takes about 3 s.
- Telegram: bad/expired/reused tokens give a clear message; link is single-use; unlinked chats get the trilingual help; `/issues 9`, `/issues abc`, free text and unknown commands answer sensibly; `/stop` really unlinks; replies are escaped. Locale follows `language_code`.
- Test alert with no channels says "Ոչինչ չուղարկվեց։ Միացրեք Telegram-ը…" instead of failing silently.
- PDFs render with Armenian glyphs, all four templates + checklist download in hy/ru; the checklist is clean and printable.

## Top 5 reasons an owner would or wouldn't pay

1. **Would pay: one Telegram message on Monday instead of reading the Labour Code.** The bot works and is trilingual. It becomes worth money only if each line tells the owner what to do and links to the PDF order (O-4).
2. **Wouldn't pay: the number cannot be trusted.** 100 for an empty company, green 88 with likely violations, reminders shown as advisories (O-2, O-6). A score that is wrong once costs the whole trust.
3. **Wouldn't pay: the biggest real risk is invisible.** Expired fixed-term contracts and ended probations vanish from the findings and the score goes up (O-1).
4. **Would pay: ready-made order and notice PDFs.** They look professional and are in Armenian. The owner does not want to find them by contract in a menu; the alert should link straight to them.
5. **Wouldn't pay yet: the product talks to accountants, not to him.** Forced "firm" setup, "firm" wording in the bot, no pricing at all ("Գները դեռ որոշվում են"), and no clear step from the free self-check into an account (O-3, O-10). A 30-per-hour Gmail sign-in limit (O-5) can also lock him out on launch day.
