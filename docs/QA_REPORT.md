# QA report (lane E)

_Run: 2026-11-19, against a local production build (`pnpm build && pnpm start`) wired to the real Supabase project (eu-west-1). Base: `cfe22b6` (includes lane B import wizard)._

## How to run
```bash
pnpm test:e2e
```
- Needs `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Without them the Supabase-backed specs skip and the public/API specs still run.
- Behind an HTTPS egress proxy (like the build sandbox), prefix with `NODE_USE_ENV_PROXY=1` so Node's `fetch` uses it. `playwright.config.ts` already sets it for the web server and routes the browser through `HTTPS_PROXY`.
- `E2E_BASE_URL=https://…` runs the suite against a deployed URL instead of a local build.
- Test users are throwaway (`qa-e-*@example.com`, created confirmed via the admin API). Global setup and teardown delete every `qa-e-*` user and the orgs they own (cascade), including leftovers from interrupted runs.
- **No real emails are sent.** The "send code" request is stubbed in the browser; the code comes from `auth.admin.generateLink` and is verified by Supabase exactly as a typed code would be. This avoids the free mailer's hourly cap and bounces to example.com.

## Results
| Suite | Tests | Result |
|---|---|---|
| Unit (vitest) | 181 | ✅ all pass |
| DB / RLS on plain Postgres (`pnpm test:db`) | 32 checks + demo seed | ✅ (unchanged by this lane) |
| E2E (Playwright, desktop + Pixel 7) | 78 passed, 6 skipped (`fixme` placeholders for lanes A, C, D) | ✅ |
| Lighthouse 12.8.2 (desktop-default, headless Chromium) | `/hy`: Perf 90 · A11y 100 · BP 100 · SEO 90<br>`/hy/login`: Perf 97 · A11y 100 · BP 100 · SEO 90 | ⚠️ SEO, see D-1 |

## Coverage
| Spec | What it proves |
|---|---|
| `public.spec.ts` | `/`, `/hy`, `/ru`, `/en`, themes and login pages (desktop + 390-px phone): HTTP < 400, correct `<html lang>`, a visible h1, no horizontal scroll, zero console errors. Light accessibility checks: one h1, labelled inputs, image alt text, accessible button/link names. Browser-language redirect (hy-AM→hy, de-DE→hy fallback, ru-RU→ru, en-US→en). The locale switcher keeps the current page. Security headers are present and `x-powered-by` is absent. |
| `api.spec.ts` | `/api/jobs/nightly` rejects missing or wrong bearer tokens (401). `/api/telegram/webhook` rejects missing or wrong secrets (401). `/api/auth/callback` never redirects off-site for `//evil`, `https://evil`, `/\evil` or `../`, and a bogus code lands on `/<locale>/login?error=1`. |
| `auth.spec.ts` | Unauthenticated `/app` redirects to login. A wrong code shows an error. The `?error=1` message shows. The full flow: code sign-in → create firm (DB shows owner membership) → notifications card (not connected, own email, test button) → app nav → sign out → `/app` is protected again, with zero console errors. Armenian UI after sign-in. A blank firm name creates nothing. |
| `tenancy.spec.ts` | **Live cross-tenant attacks via PostgREST.** Firm B cannot read A's orgs, companies, employees, contracts, leave, findings, alerts, audit log or Telegram links. B's update or delete of A's company, employee or finding affects 0 rows, verified with the service role. B cannot insert into A's org, join it, or attach an employee to A's company under B's own org (composite FK). A cannot rewrite severity, only status, and `resolved_by` is recorded. Users cannot write rules, audit or alerts. Telegram tokens are 64 hex characters and unreadable, and users cannot link a chat directly. Anon reads nothing and cannot call either RPC. |
| `import.spec.ts` | Armenian-header CSV with DD.MM.YYYY dates and one impossible date → auto-mapping → preview (2 valid, 1 error) → import → exactly 2 employees in the DB → rule run wrote `probation-minor` → score shown. Re-importing the same file adds no duplicates. |
| `features.spec.ts` | `fixme` placeholders with TODOs for the dashboard (lane A), PDF + quiz (lane C) and self-check + sitemap (lane D). Enable them when those lanes merge. |

## Defects
| ID | Severity | Owner | Defect | Repro | Fix |
|---|---|---|---|---|---|
| D-1 | Low (SEO) | lane D / layout | hreflang alternates are **relative** (`<link rel="alternate" hreflang="hy" href="/hy">`), so Lighthouse SEO is 90. Every page also advertises only the locale roots, so `/hy/login` lists `/ru` rather than `/ru/login`. | Lighthouse `/hy` → "hreflang: Relative href value" | Set `metadataBase` (e.g. from `VERCEL_PROJECT_PRODUCTION_URL`) in `src/app/[locale]/layout.tsx`, and build per-page `alternates.languages` from the current pathname. |
| D-2 | Low (integration) | lane A | The import "Open the company page" link points at `/<locale>/app/companies/<id>`, which does not exist until lane A merges. Prefetching it logs a 404 to the console. | Finish an import and watch the console | Resolved when lane A ships `app/companies/[id]`. The import spec tolerates exactly this 404 until then; remove the allowance at merge. |
| D-3 | Info (product) | product | Locale is negotiated from the browser language, so an Armenian user with a Russian or English browser lands on `/ru` or `/en`, not the brief's `hy` default. | Visit `/` with `Accept-Language: ru` | Intentional next-intl behaviour, but confirm with the product owner. To force Armenian at the root, set `localeDetection: false` in `src/i18n/routing.ts`. |
| D-4 | Low (perf) | lane D | Total Blocking Time on `/hy` is 340 ms (score 0.74), probably next-intl plus client components on the landing page. | Lighthouse `/hy` | Revisit after the lane D landing page lands; keep the hero server-rendered. |

## Not covered yet
- Real email delivery: covered manually once the Supabase template carries `{{ .Token }}`.
- Telegram deep-link and webhook round trip: needs the bot token and the public URL with the protection bypass.
- Visual regression and screen-reader passes, and full axe-core rules (only the light built-in checks above; adding `@axe-core/playwright` (MPL-2.0) needs approval).
