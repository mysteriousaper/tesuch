# Tesuch · Տեսուչ

Keeps Armenian companies ready for a labour inspection: an Inspection-Ready Score, a per-employee timeline, and alerts before a legal deadline is missed. Built as a deterministic, versioned rules engine, not an AI chatbot. UI in Armenian, Russian and English.

> ⚠️ All rules are currently `needs_lawyer_review` and show as **advisory** only. This is not legal advice.

## Stack
- Next.js 15 (App Router, React 19, Tailwind 4), next-intl with a `[locale]` segment (`hy` / `ru` / `en`)
- Supabase: Postgres with row-level security per organization, Auth
- `json-rules-engine` for the rules in `rules/*.json`
- Vercel Hobby: hosting plus one daily cron (`/api/jobs/nightly`)
- Telegram bot and Resend for alerts
- Vitest (unit), plain-SQL tests on a throwaway Postgres, Playwright (e2e)

## Local setup
Requires Node 22 and pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # then fill in the values below
pnpm dev                     # http://localhost:3000
```

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | everything (Supabase → Project Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | nightly job, health check, e2e. Server only, never in the browser |
| `CRON_SECRET` | auth of `/api/jobs/nightly` (`openssl rand -hex 32`) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Telegram alerts and bot commands (optional) |
| `RESEND_API_KEY`, `ALERT_FROM_EMAIL` | email alerts (optional) |

Database schema lives in `supabase/migrations/`; see [docs/RUNBOOK.md](docs/RUNBOOK.md) for applying it.

## Commands
| Command | What it does |
|---|---|
| `pnpm dev` | dev server |
| `pnpm test` | unit tests (rules engine, logic) |
| `pnpm test:db` | migrations + RLS cross-tenant tests on a throwaway local Postgres (not as root) |
| `pnpm test:e2e` | Playwright against a production build and the real Supabase project from `.env.local` |
| `pnpm seed:demo` | load demo data |
| `pnpm rules:matrix` | regenerate `docs/RULES_MATRIX.md` from `rules/*.json` |
| `pnpm lint` · `pnpm typecheck` · `pnpm build` | static checks and production build |

## CI
`.github/workflows/ci.yml`: `app` (audit of production dependencies, lint, typecheck, unit tests, build), `database` (SQL tests) and `e2e`. The e2e job runs only when the repository secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` exist; otherwise it is skipped with a notice.

## Deploy
- Vercel: import the repo, set the variables from the table above (Production and Preview), deploy. Previews first; promote to production deliberately.
- `vercel.json` registers the daily cron. Vercel sends `Authorization: Bearer $CRON_SECRET`.
- Uptime monitors can poll `GET /api/health`: `{ ok, version, time, db: { ok, latencyMs } }`, `no-store`, 503 if the database is unreachable. It exposes no secrets.
- After the first deploy register the Telegram webhook (see the runbook).

## Docs
[PRD](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md) · [Runbook](docs/RUNBOOK.md) · [Rules matrix](docs/RULES_MATRIX.md) · [Plan](docs/PLAN.md) · [Decisions](docs/DECISIONS.md) · [Security review](docs/SECURITY_REVIEW.md) · [Investor requests](docs/INVESTOR_REQUESTS.md)
