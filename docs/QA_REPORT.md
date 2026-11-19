# QA report (lane E)

_Run: 2026-11-19, against a local production build (`pnpm build && pnpm start`) wired to the real Supabase project (eu-west-1). Base: `origin/claude/gallant-dijkstra-unyblc` @ `52b1d0d`, which includes lanes A (dashboard), B (import) and D (landing, self-check, SEO). Lane C (documents, quiz) is still in progress._

## How to run
```bash
pnpm test:e2e
```
- Needs `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Without them the Supabase-backed specs skip and the public/API/SEO specs still run.
- Behind an HTTPS egress proxy (like the build sandbox), prefix with `NODE_USE_ENV_PROXY=1` so Node's `fetch` uses it. `playwright.config.ts` already sets it for the web server and routes the browser through `HTTPS_PROXY`.
- `E2E_BASE_URL=https://…` runs the suite against a deployed URL instead of a local build.
- Test data is throwaway:
  - Users are `qa-e-*@example.com`, created confirmed via the admin API.
  - Global setup and teardown delete every `qa-e-*` user and the orgs they own (cascade), including leftovers from interrupted runs.
  - Lead rows created by the self-check spec are deleted with the service role in a `finally` block.
- **No real emails are sent.** The "send code" request is stubbed in the browser; the code comes from `auth.admin.generateLink` and is verified by Supabase exactly as a typed code would be.

## Results
| Suite | Tests | Result |
|---|---|---|
| Unit (vitest) | 192 | ✅ all pass |
| E2E (Playwright, desktop + Pixel 7) | **101 passed**, 2 skipped (lane C `fixme`) | ✅ |
| Lighthouse 12.8.2, `/hy` | Perf **95** · A11y **100** · BP **100** · SEO **92** | ✅ (SEO, see note) |
| Lighthouse 12.8.2, `/hy/check` | Perf **95** · A11y **100** · BP **100** · SEO **92** | ✅ (SEO, see note) |

**SEO note:** the only failing SEO audit is `canonical`, and only because the test runs on `localhost` while the canonical correctly points at `https://tesuch.vercel.app/…`. On the deployed domain they match. hreflang now passes (D-1 fixed). Total Blocking Time on `/hy` dropped from 340 ms to 80 ms (D-4 fixed).

## Coverage
| Spec | What it proves |
|---|---|
| `public.spec.ts` | Landing, themes, login and **self-check** pages in all locales, on desktop and a 390-px phone: HTTP < 400, correct `<html lang>`, a visible h1, no horizontal scroll, zero console errors. Light accessibility checks: one h1, labelled inputs, image alt text, accessible button/link names. `/` always redirects to Armenian, whatever the browser language (D-3 decision). The locale switcher keeps the current page. Security headers are present and `x-powered-by` is absent. |
| `api.spec.ts` | The nightly job rejects missing or wrong bearer tokens (401). The Telegram webhook rejects missing or wrong secrets (401). The auth callback never redirects off-site, and a bogus code lands on `/<locale>/login?error=1`. |
| `auth.spec.ts` | Unauthenticated `/app` redirects to login. A wrong code shows an error. The full flow: code sign-in → create firm (owner membership in DB) → notifications card under Settings → app nav → sign out → `/app` is protected again. Armenian UI after sign-in. A blank firm name creates nothing. |
| `tenancy.spec.ts` | Live cross-tenant attacks via PostgREST across all tenant tables. Update and delete affect 0 rows, verified with the service role. B cannot join A's org or attach rows to A's company (composite FK). Users can change only a finding's status. Users cannot write rules, audit or alerts. Telegram tokens are private. Anon reads nothing and cannot call the RPCs. |
| `import.spec.ts` | Armenian-header CSV with one impossible date → map → preview (2 valid, 1 error) → import → exactly 2 employees → `probation-minor` finding → score shown → **"Open the company page" opens the company (no 404; D-2 allowance removed)**. Re-import adds no duplicates. |
| `dashboard.spec.ts` | **Lane A:** empty firm → *Load demo data* → 5 companies and findings in the DB → list sorted riskiest first → firm gauge, mobile layout and a11y clean. Company page: findings cite arlis.am and show the "not legal advice" note; **mark fixed** and **dismiss** (DB shows `fixed` + `dismissed` with `resolved_by` = the user; the score never drops); **re-check** reopens the "fixed" finding because the data didn't change, while the dismissed one stays dismissed. **Employee timeline:** h1 = employee, "Today" marker, "Started work" event, dates in order, a11y clean. **Another firm's company URL returns 404** and leaks no names. |
| `landing.spec.ts` | **Lane D:** the self-check's 10 questions → score gauge → advisory issues linked to arlis.am → disclaimer. Restart works. **Lead submission** stores exactly one row (email, locale, size, role, consent, 10 answers), and a repeat within 10 minutes is **throttled** in the UI and DB; the row is then deleted. Anon cannot read or insert `leads` directly, and the RPC rejects an invalid email. **sitemap.xml** lists `/{hy,ru,en}` and `/{hy,ru,en}/check` with hreflang alternates and no private paths. **robots.txt** disallows `/api/`, `/*/app`, `/*/themes` and points to the sitemap. Pages carry absolute, per-page hreflang alternates and a canonical. |
| `features.spec.ts` | `fixme` placeholders for lane C (PDF downloads, weekly quiz), to enable when it merges. |

## Defects
| ID | Status | Defect | Resolution |
|---|---|---|---|
| D-1 | ✅ fixed (lane D) | hreflang alternates were relative and listed only locale roots. | Absolute, per-page alternates; covered by `landing.spec.ts`. |
| D-2 | ✅ fixed (lane A) | The import's "Open the company page" link 404'd before the company page existed. | Allowance removed; the import spec now follows the link. |
| D-3 | ✅ decided | Browser-language redirect sent Armenian users with ru/en browsers away from `hy`. | `localeDetection: false`; Armenian is the default for everyone. |
| D-4 | ✅ fixed | TBT 340 ms on `/hy`. | Now 80 ms; Perf 95. |

No new defects were found in lanes A, B or D.

## Not covered yet
- Lane C: PDF downloads and the weekly quiz, still `fixme`.
- Real email delivery: covered manually once the Supabase template carries `{{ .Token }}`.
- Telegram deep-link and webhook round trip: needs the bot token and the public URL with the protection bypass.
- Visual regression, screen-reader passes and full axe-core rules (only the light built-in checks; `@axe-core/playwright` is MPL-2.0 and needs approval).
