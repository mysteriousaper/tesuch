# QA war: rules

Five fighters test Tesuch in parallel. Each writes ONE report: `docs/qa/<fighter>.md` on branch `claude/qa-<fighter>`.

## Scoring (judge)
| Points | For |
|---|---|
| 10 | Critical gap (data leak, lockout, wrong legal result, crash on a main flow) |
| 5 | Major gap (main flow broken or confusing, missing must-have for a paying firm) |
| 2 | Minor gap (cosmetic, copy, small UX) |
| 0 | Not reproducible, duplicate of a known item in docs/ARENA.md, or opinion without evidence |
| ×1.5 | Fix suggestion precise enough to implement (file:line, exact change) |

Every finding needs: severity, steps to reproduce, expected vs actual, evidence (screenshot path in docs/qa/shots/<fighter>/ or command output), suggested fix.

## Rules
- Find and report only. Do NOT change app code (round 2 fixes). Small test helpers under `docs/qa/` are fine.
- Test against a local production build (`pnpm build && pnpm start -p <port>`) with the real Supabase project; throwaway users via `tests/e2e/helpers/supabase.ts` (`createTestUser`), always cleaned up.
- Never print secrets. Never email real addresses (stub `/auth/v1/otp` like `tests/e2e/helpers/auth.ts`).
- Use the caveman voice for chat (see CLAUDE.md); reports are full sentences.
