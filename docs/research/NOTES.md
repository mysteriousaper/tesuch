# Research notes

Video research (`/watch`) was not possible: YouTube is blocked in the build environment. These notes come from the libraries' official documentation as known at build time. Re-check versions before relying on details.

## Supabase RLS, multi-tenant
- Put membership checks in `security definer` functions in a non-exposed schema; otherwise a policy on `memberships` that queries `memberships` recurses.
- Wrap `auth.uid()` as `(select auth.uid())` so Postgres evaluates it once per statement, not per row.
- Always add `with check` on insert and update, or users can move rows into another tenant.
- Index every `org_id` used in policies.
- Pitfall: the service role bypasses RLS, so use it only server-side (nightly job), never in the browser.

## Next.js App Router + Supabase Auth
- Use `@supabase/ssr` with cookie-based sessions; refresh the session in `middleware.ts`.
- Server components read via a server client; never trust `getSession()` on the server, use `getUser()`.

## json-rules-engine
- Facts can be async functions with `params`, which lets rule JSON carry thresholds.
- `allowUndefinedFacts: false` makes a missing fact an error instead of a silent false.
- Pitfall: `lessThan` against `null` is true in JS, so use sentinels (Infinity) for unknown values.

## next-intl (App Router)
- `[locale]` segment + middleware; `defaultLocale: 'hy'`, `locales: ['hy','ru','en']`.
- Set `<html lang>` per locale. Armenian needs fonts with the Armenian block (Noto Sans Armenian).

## Scheduled jobs
- Vercel Hobby cron: once per day maximum. Protect the route with `CRON_SECRET`.
- Supabase alternative: `pg_cron` + `pg_net` POSTing to the same route, or an Edge Function.

## Telegram bot on Vercel
- Use a webhook (`setWebhook`) with `secret_token`, and verify the `X-Telegram-Bot-Api-Secret-Token` header.
- Link an account through a one-time deep link `t.me/<bot>?start=<token>` and store the `chat_id`.

## @react-pdf/renderer with Armenian
- Register Noto Sans Armenian with `Font.register` from a bundled TTF. Mix in Noto Sans for Latin and Cyrillic, or use a font family fallback per text run.
- Runs in Node runtime only (not Edge).

## GSAP
- GSAP and all its plugins (ScrollTrigger, SplitText) are free since 2025 under the GSAP standard licence. Record it in `design/SOURCES.md`.
- Respect `prefers-reduced-motion`.
