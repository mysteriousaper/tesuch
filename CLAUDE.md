# Tesuch — rules for agents

Tesuch (Տեսուչ) keeps Armenian companies ready for a labour inspection. Next.js 15 App Router + TypeScript, Supabase (EU, project `fbzzhtfakcwnwfuxrqsi`), Vercel Hobby, next-intl (`hy` default, `ru`, `en`).

## Voice (token budget)
- Use the `caveman` skill (`.claude/skills/caveman`) for chat and status output from the start of every session. Terse, every fact kept.
- Exempt: anything persisted (code, comments, docs, commits, UI strings, legal text), security warnings, questions to the human.

## Hard rules
- No payments, billing or Stripe in the product.
- Legal logic = versioned rules in `rules/*.json`. Never invent article numbers. Unverified rules show as advisory only.
- No AI-generated people, faces or voices in any asset.
- Every UI string in hy/ru/en (`messages/<locale>/<namespace>.json`; register new namespaces in `src/i18n/request.ts`). Natural Eastern Armenian, reformed spelling, punctuation ։ ՝ ՞ « ».
- Multi-tenant RLS on every table; derive `org_id` from rows read through the user's RLS client, never from client input. Service role only after a role check.
- Stay inside the files your department owns (`docs/ORG.md`). Shared files are changed by the lead session.
- Model policy and execution model: `docs/ORG.md`.

## Commands
- `pnpm lint && pnpm typecheck && pnpm test`: must be green before handing back.
- `runuser -u postgres -- bash supabase/tests/run.sh`: migrations + RLS/lane DB tests on throwaway Postgres.
- `NODE_USE_ENV_PROXY=1 E2E_PORT=<unique> pnpm test:e2e <spec> --trace off`: Playwright against real Supabase (needs `.env.local`; throwaway users via `tests/e2e/helpers`).
- Node or servers that call Supabase in this sandbox need `NODE_USE_ENV_PROXY=1`.
- Never apply migrations to the real database or push to `main` unless you are the lead session.
