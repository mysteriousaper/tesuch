# Agent arena

Parallel agents, each owning separate files, race through the task pool. A judge agent scores every finished task. Agents that finish early take the next task from the pool.

## Scoring (judge)
| Criterion | Points |
|---|---|
| Works end to end (judge runs it) | 30 |
| Tests: meaningful, passing, cover edge cases | 20 |
| Code quality: small, readable, follows existing patterns | 15 |
| Security (RLS respected, no secrets, input validated) | 15 |
| UX: hy/ru/en, mobile 390px, accessibility, empty/error states | 15 |
| Speed (rank order of finishing) | 5 |

Hard fails (score 0 for the task): failing lint/typecheck/tests, editing files outside your lane, new dependencies without approval, invented article numbers, AI-generated people in assets.

## Lanes and task pool
| Lane | Agent | Task | Owns |
|---|---|---|---|
| A | dashboard | Firm dashboard, company page, employee timeline, findings fix/dismiss, add company/employee, demo data loader, "re-check now", settings page | `src/app/[locale]/app/page.tsx`, `app/companies/**`, `app/settings/**`, `src/components/dashboard/**`, `messages/*/dashboard.json`, migration `…0200_*` |
| B | import | CSV/Excel import wizard UI (upload → map → preview → commit → run rules) | `app/import/**`, `src/components/import/**`, `messages/*/import.json` |
| C | outputs | PDF download routes + documents page; weekly quiz UI with persistence, streaks, badges | `app/documents/**`, `app/quiz/**`, `src/app/api/pdf/**`, `src/components/quiz/**`, `messages/*/{documents,quiz}.json`, migration `…0300_*` |
| D | marketing | Landing page, free 10-question self-check with lead capture, SEO (sitemap, robots, metadata) | `src/app/[locale]/page.tsx`, `src/app/[locale]/check/**`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/components/landing/**`, `messages/*/{landing,check}.json`, migration `…0400_*` |
| E | qa | Playwright e2e on real Supabase with throwaway test users, a11y checks, cross-tenant tests through the API | `tests/e2e/**`, `playwright.config.ts`, `package.json` (devDeps only) |
| J | judge | Scores each lane, files defects back | `docs/ARENA.md` (results section) |

## Results
_Filled in by the judge._
