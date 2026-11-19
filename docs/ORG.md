# Tesuch agent organisation

```
CEO (lead session): priorities, merges, deploys, final review
├── Engineering dept (manager) ─ members & invitations, audit log viewer, data export/delete
├── Legal & Compliance dept (manager) ─ privacy/terms pages, sign-up consent records, DPA download
├── Localization dept (manager) ─ hy/ru/en language review, user guide in hy/ru
├── Messaging dept (manager) ─ Telegram bot commands, digest preview
├── Platform dept (manager) ─ error/404/loading pages, health endpoint, CI e2e job, README + runbook
└── QA dept (lane E, after others) ─ full regression, a11y deep audit
```

Rules for every department:
- Managers plan, split work among their own workers (max 3), review workers' output, and hand one tested commit to the CEO.
- Each department owns only its listed files (below). Shared files are changed only by the CEO.
- Every string in hy/ru/en (natural Eastern Armenian, reformed spelling). Mobile 390px, accessible, empty/error states.
- Before handing back: `pnpm lint`, `pnpm typecheck`, `pnpm test`, DB tests (`runuser -u postgres -- bash supabase/tests/run.sh`), and the department's e2e specs with a unique `E2E_PORT`.
- New migrations get the department's timestamp prefix; the CEO applies them to the real database.

| Department | Owns | Migration prefix | e2e port |
|---|---|---|---|
| Engineering | `src/app/[locale]/app/{members,audit}/**`, `src/app/[locale]/invite/**`, `src/components/members/**`, `messages/*/{members,audit}.json`, `tests/e2e/members.spec.ts`, `supabase/tests/dept_eng.sql` | `20261119020000` | 3201 |
| Legal & Compliance | `src/app/[locale]/{privacy,terms}/**`, `src/components/legal/**`, `messages/*/{legal,privacy}.json`, `docs/legal/**`, `tests/e2e/legal.spec.ts`, `supabase/tests/dept_legal.sql` | `20261119030000` | 3202 |
| Localization | `messages/*/{common,home,themes,auth,onboarding,notifications,app,landing,check,quiz}.json`, `docs/guide/**` | none | 3203 |
| Messaging | `src/lib/notify/telegram-bot.ts`, `src/lib/notify/commands*.ts`, `src/app/api/telegram/**`, `tests/e2e/telegram.spec.ts` | none | 3204 |
| Platform | `src/app/[locale]/{error,not-found,loading}.tsx`, `src/app/global-error.tsx`, `src/app/api/health/**`, `messages/*/errors.json`, `.github/workflows/**`, `README.md`, `docs/RUNBOOK.md` | none | 3205 |
