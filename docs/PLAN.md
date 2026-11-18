# Build plan

✅ done · 🔜 next · ⏸ blocked on the human · ∥ can run in parallel

## Phase A: Understand ✅
- ✅ PRD (`docs/PRD.md`)
- ✅ Rules matrix + 12 rule JSON files (`docs/RULES_MATRIX.md`, `rules/`)
- ✅ Research notes (`docs/research/NOTES.md`; YouTube is blocked in this environment, so they're docs-based)

## Phase B: Architect and plan ✅
- ✅ `docs/ARCHITECTURE.md`, this file

## Phase C: Build
### Stream 1: Foundation
- ✅ Next.js + TypeScript + Tailwind scaffold
- ✅ Schema, RLS and audit migration, with cross-tenant tests running on plain Postgres
- ✅ CI: lint, typecheck, unit tests, build, DB/RLS tests
- 🔜 next-intl skeleton (hy/ru/en) + fonts
- ⏸ Supabase project (EU) → link, push migration, Auth (email magic link)
- 🔜 Auth pages, `create_org` onboarding, members page

### Stream 2: Rules engine ∥
- ✅ Engine, facts, catalog validation, score; 43 unit tests (boundaries, leap years, six-day week, minors)
- 🔜 Seed `rules` table from JSON (script plus CI check that the DB and JSON match)
- 🔜 Nightly job endpoint: upsert and close findings (needs Supabase)

### Stream 3: App UI ∥ (after theme choice ⏸)
- Firm dashboard (companies sorted by score) → company page → employee timeline → findings with fix actions
- CSV/Excel import with column mapping (SheetJS CE is Apache-2.0; ArmSoft preset once we have a sample ⏸)

### Stream 4: Outputs ∥
- ⏸ Telegram bot (BotFather token): connect, alerts, weekly digest
- ⏸ Resend: alerts and digest email
- PDF orders and checklists (Noto Sans Armenian)
- Weekly quiz, streaks, badges

### Stream 5: Marketing site ∥
- Landing page (design factory, 3 themes → human picks one ⏸)
- 10-question self-check lead magnet + email capture
- SEO in hy/ru

## Phase D: Harden
Playwright end-to-end on key flows, a11y, Lighthouse ≥ 90, security review, demo seed data (3 firms / 15 companies / 200 fictional employees).

## Phase E: Launch kit
`docs/gtm/*` (ICP, prospects, pricing for later, playbook, metrics) + Vercel deploy on `*.vercel.app`.
