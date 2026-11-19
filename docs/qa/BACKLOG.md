# QA backlog

Source: `docs/qa/RESULTS.md` (judged 2026-11-19). Owned by the program manager (`docs/qa/MANAGER.md`). Area `owner` = needs the human (Supabase dashboard, lawyer, real files, domain, product decision).

| Id | Severity | Area | Files | Fix summary | Status |
|---|---|---|---|---|---|
| C-1 | critical | security | `supabase/migrations/20261118000000_init.sql:286-288`, `src/components/dashboard/queries.ts:20` | Drop `memberships_owner_write`; revoke insert/update; grant `update (role)`; owner-only update policy; delete for owner or self; DB test that an owner cannot insert another user's membership | open |
| C-2 | critical | data | `src/components/dashboard/queries.ts:44-46`, `src/lib/jobs/run.ts:46-49` | Grouped count RPC (or exact head counts) for dashboard; paged reads in `runRulesForCompany`; unit test with 1001 rows | open |
| C-3 | critical | data | `src/lib/import/normalize.ts:74-76`, `src/lib/import/pipeline.ts:50,74`, `src/lib/import/fields.ts`, `src/lib/rules/facts.ts`, `rules/annual-leave-min.json`, `rules/src-registration.json`, `rules/fixed-term-ground.json`, `src/components/import/import-wizard.tsx` | Tri-state unknown for SRC flag and fixed-term ground; rules skip unknown; skip leave rule without leave records; preview lists unmapped fields and impact; leave columns in import | open |
| C-4 | critical | owner | Supabase Auth settings, `src/app/[locale]/login/login-form.tsx:24` | Enable CAPTCHA (dashboard) and pass `captchaToken`; real SMTP provider with verified domain and higher email rate limit; localized 429 message | open |
| M-1 | major | owner | Supabase Auth URL configuration and email templates, `docs/RUNBOOK.md` | Exact redirect hosts only; remove `{{ .ConfirmationURL }}` from recovery/invite templates; document | open |
| M-2 | major | security | `supabase/migrations/20261118000000_init.sql:217-240,315`, `src/app/[locale]/app/members/actions.ts:111` | Strip personal columns from audit rows (or null on employee delete); `audit_log.org_id` FK with cascade; lawyer confirms retention | open |
| M-3 | major | security | `supabase/migrations/20261119010000_leads_throttle.sql:35`, `src/app/[locale]/check/actions.ts:28` | Per-IP-hash throttle in `submit_lead`; raise global cap; honeypot field | open |
| M-4 | major | data | `src/lib/rules/facts.ts:25-27`, `rules/fixed-term-ending.json`, `src/lib/rules/engine.ts` | Advisory rule `fixed-term-expired` with `hasSuccessorContract` fact; no auto-resolve when `isActive` flips | open |
| M-5 | major | data | `src/lib/rules/engine.ts:13-15` | Info rules stay `info` (0 points, no alert); unit test | open |
| M-6 | major | ux | `src/components/dashboard/queries.ts:58`, `src/components/dashboard/company-list.tsx`, `src/app/[locale]/app/companies/[id]/page.tsx`, `src/lib/notify/i18n.ts:48` | `score: null` for 0 staff, excluded from firm average; "No data yet" + CTA in UI, PDF, bot | open |
| M-7 | major | product | `src/lib/rules/score.ts:4-9`, `src/lib/notify/commands.ts`, `src/app/[locale]/app/page.tsx` | Normalise or cap penalty; open finding caps icon below green; "how is this scored" popover; findings count beside score | open |
| M-8 | major | ux | `src/components/dashboard/finding-list.tsx:84-87`, `src/app/[locale]/app/page.tsx:48`, `src/app/[locale]/app/companies/[id]/page.tsx` | Disclaimer under each score gauge | open |
| M-9 | major | perf | `src/app/[locale]/app/companies/[id]/page.tsx:26,61`, `src/components/dashboard/finding-list.tsx` | Group findings by rule, filters, page at 50, employee search | open |
| M-10 | major | ux | `src/app/[locale]/app/actions.ts`, `src/app/[locale]/app/companies/[id]/page.tsx` | Owner-only update/archive/delete company; hide demo button once loaded | open |
| M-11 | major | data | `src/lib/import/parse.ts:17-26`, `src/components/import/import-wizard.tsx` | Header-row detection by alias matches; manual "header row" input | open |
| M-12 | major | data | `src/components/import/import-wizard.tsx:48` | Decode UTF-8 fatal, fall back to windows-1251, show encoding switch | open |
| M-13 | major | data | `src/app/[locale]/app/import/actions.ts`, `src/lib/import/presets.ts:8` | Re-sync upsert with New/Changed/Unchanged preview; saved mappings; ArmSoft preset only from a real anonymised file (owner supplies) | open |
| M-14 | major | ux | `src/components/dashboard/finding-list.tsx`, `src/app/[locale]/app/actions.ts:169`, new migration | Bulk fix/dismiss; required `dismissed_reason` | open |
| M-15 | major | ux | `src/app/[locale]/app/audit/page.tsx` | Hide system findings rows by default; entity names; changed keys | open |
| M-16 | major | ux | `src/components/documents/contract-docs.tsx`, `src/app/api/pdf/_lib/load.ts` | Show probation orders only when relevant; name filter; employee slug in filename | open |
| M-17 | major | product | new `src/app/[locale]/app/inbox/**`, migration `findings.assignee_id` | Firm deadline inbox (feature F1) | open |
| M-18 | major | product | `src/lib/pdf/documents.ts`, new `src/app/api/export/**` | Client report PDF (F2), XLSX findings export, sorted checklist with summary | open |
| M-19 | major | security | `supabase/migrations/20261118000000_init.sql`, `supabase/migrations/20261119020000_members.sql` | `company_members` + `private.can_see_company()` RLS; company-scoped invitations (F4) | open |
| M-20 | major | product | `src/app/api/jobs/nightly/route.ts`, new migration | `score_snapshots` from nightly job; trend UI (F2) | open |
| M-21 | major | owner | `rules/src-registration.json`, `src/lib/rules/engine.ts` | Lawyer confirms SRC dates; `src_status` tracker (F3); no "due today" without verified date | open |
| M-22 | major | owner | `rules/`, product copy | Lawyer-written OSH document checklist (advisory); decide score label | open |
| M-23 | major | product | `src/app/[locale]/app/actions.ts:77`, org setup UI, `src/lib/notify/commands.ts` | "One company / accounting firm" choice; auto-create company for `kind = company` | open |
| M-24 | major | product | `src/lib/notify/messages.ts`, `rules/*.json` | Per-rule action text (lawyer-reviewed), app and PDF links in alerts/digest, settings link in email footer | open |
| M-25 | major | a11y | `src/app/globals.css:26,45,64`, `src/components/dashboard/action-form.tsx:7,10`, `src/components/members/forms.tsx:10,12`, `src/components/dashboard/finding-actions.tsx:10`, `src/components/import/import-wizard.tsx:26` | `--control` token ≥ 3:1 for inputs and outlined buttons; token test | open |
| M-26 | major | perf | demo button in `src/components/dashboard/*`, `src/app/[locale]/app/actions.ts:115` | Pending text + `role="status"`; batched inserts; `maxDuration` | open |
| m-1 | minor | security | `src/app/[locale]/app/layout.tsx:21`, `src/app/api/pdf/_lib/load.ts:19`, `src/app/[locale]/app/members/data/export/route.ts`, `supabase/migrations/20261119030000_consent.sql:25` | Consent enforced in DB writes and route handlers; server-set `ip_hash` | open |
| m-2 | minor | security | `supabase/migrations/20261119020000_members.sql:61-79` | Revoke invitations of demoted/removed owners | open |
| m-3 | minor | security | `next.config.ts:14-20` | Content-Security-Policy (report-only first) | open |
| m-4 | minor | owner | Supabase Auth settings | `site_url` = production origin | open |
| m-5 | minor | ux | `src/app/[locale]/app/app-nav.tsx:21` | Scroll cue / wrap / "More" menu on mobile nav | open |
| m-6 | minor | ux | `src/components/dashboard/company-list.tsx`, import/documents/quiz pages | Dashboard filter; remember last company | open |
| m-7 | minor | data | `src/app/[locale]/app/actions.ts:102-113`, new migration | Unique `(org_id, tax_id)`; duplicate-name warning | open |
| m-8 | minor | i18n | `messages/hy/audit.json:4` | Rephrase without `{org}-ի` | open |
| m-9 | minor | i18n | `messages/*/audit.json`, `messages/*/members.json`, `messages/*/quiz.json` | «Проблемы/Issues» for findings; one quiz name per glossary | open |
| m-10 | minor | ux | `src/app/[locale]/app/import/page.tsx` | Hide "Add company" CTA for viewers | open |
| m-11 | minor | ux | `src/app/[locale]/app/actions.ts:152` | Revalidate and refresh after re-check | open |
| m-12 | minor | ux | `src/app/[locale]/app/quiz/**`, `messages/*/quiz.json` | Explain quiz/streak scope | open |
| m-13 | minor | data | `src/components/dashboard/dashboard-forms.tsx:94` | No default on SRC checkbox (tri-state with C-3) | open |
| m-14 | minor | ux | `src/app/[locale]/check/questions.ts`, `messages/*/check.json` | Positive polarity; split Q4 | open |
| m-15 | minor | product | `messages/*/check.json`, `src/app/[locale]/check/**` | Softer verdict; sign-up CTA; action per item | open |
| m-16 | minor | product | `src/components/quiz/streak-panel.tsx`, `src/lib/quiz/**` | Streak pending until week end; mark unverified items advisory | open |
| m-17 | minor | ux | `src/lib/pdf/documents.ts` | Keep dismissal notice on one page; localized footer | open |
| m-18 | minor | product | `src/app/api/jobs/nightly/route.ts:45`, settings page | "All clear" digest; notification toggles | open |
| m-19 | minor | a11y | `src/components/quiz/streak-panel.tsx:34` | Remove `opacity-50` on locked badges | open |
| m-20 | minor | a11y | `src/components/theme-preview.tsx:41` | Darker small label colour | open |
| m-21 | minor | a11y | `src/app/[locale]/app/layout.tsx:33`, `src/components/landing/site-footer.tsx:27` | Targets ≥ 24 px | open |
| m-22 | minor | a11y | both layouts, `messages/*/common.json` | Skip-to-content link | open |
| m-23 | minor | i18n | `src/app/[locale]/check/page.tsx:29`, `src/app/[locale]/page.tsx:38`, `src/app/[locale]/app/audit/page.tsx:92`, `src/app/[locale]/not-found.tsx` | No uppercase/tracking for hy | open |
| m-24 | minor | a11y | `src/components/documents/contract-docs.tsx:31-45`, `src/components/import/import-wizard.tsx:184`, `src/components/quiz/streak-panel.tsx:4,18` | `aria-hidden` decorative glyphs | open |
| m-25 | minor | ux | `src/components/landing/hero-mock.tsx:69`, `src/app/[locale]/page.tsx:101-106` | `line-clamp-2`; nowrap stat values | open |
| m-26 | minor | i18n | `src/components/landing/site-footer.tsx:20` | Localized app name in footer | open |
| m-27 | minor | ux | `src/app/[locale]/login/login-form.tsx`, `messages/*/auth.json` | "Use another e-mail" link | open |
| m-28 | minor | perf | `src/app/[locale]/login/page.tsx`, `messages/*/auth.json` | Login meta description (SEO) | open |
| m-29 | minor | i18n | `src/lib/pdf/documents.ts:264-266` | hy PDF punctuation and column widths | open |
| m-30 | minor | i18n | `messages/hy/members.json`, `messages/hy/errors.json`, `messages/*/auth.json` | Lower-case «ձեր/դուք»; «ֆիրմա»; drop "Supabase" | open |
| m-31 | minor | product | `src/app/[locale]/app/companies/[id]/page.tsx`, contracts migration | Optional `position` on contracts | open |
| F1 | feature | product | new `src/app/[locale]/app/inbox/**`, migration | Firm deadline inbox with filters and assignee (spec in `product.md` §5 F1); after C-2 | open |
| F2 | feature | product | new migration `score_snapshots`, `src/app/api/jobs/nightly/route.ts`, `src/lib/pdf/**` | Score history + monthly client report PDF; after M-6/M-7 | open |
| F3 | feature | owner | `rules/src-registration.json`, contracts migration, company page | SRC e-contract tracker; rule date needs the lawyer | open |
| F4 | feature | security | RLS migrations, members/invitations, `src/lib/notify/**` | Company-scoped client access + owner digest; after C-1, with cross-tenant tests | open |
| F5 | feature | data | `src/app/[locale]/app/import/**`, `src/lib/import/**`, new `import_mappings` migration | Re-sync import, saved mappings, ArmSoft preset (real file from owner) | open |

## C-4: owner steps (Supabase dashboard, project `fbzzhtfakcwnwfuxrqsi`)
Status: **waiting for owner** (needs dashboard access; not doable from the repo). After steps 1-2 tell the manager, who then wires `captchaToken` into `src/app/[locale]/login/login-form.tsx` and the localized 429 message.
1. Create a Cloudflare Turnstile (or hCaptcha) site: Cloudflare dashboard > Turnstile > Add site, domain = production host, mode Managed. Copy site key and secret key.
2. Supabase dashboard > Authentication > Attack Protection > "Enable Captcha protection", provider Turnstile, paste the secret key, Save. Add the site key to Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Preview + Production).
3. Supabase dashboard > Authentication > Emails > SMTP Settings > "Enable Custom SMTP". Use Resend (or another provider) with a verified sending domain (add the SPF/DKIM DNS records it shows). Fill host, port, user, password, sender `Tesuch <noreply@your-domain>`. Save.
4. Supabase dashboard > Authentication > Rate Limits: raise "Rate limit for sending emails" (only editable after step 3) from the default 30/hour to e.g. 200/hour; keep "Rate limit for sign-ups and sign-ins" per IP.
5. Re-test: request 5 OTPs from one IP, confirm CAPTCHA is demanded and other users can still sign in.
