# Program manager charter

The manager runs as its own cloud session (Sonnet) after the QA war. It owns `docs/qa/BACKLOG.md` and drives fix rounds until the Definition of Done holds, then stops.

## Loop (one round)
1. Read `docs/qa/RESULTS.md`, `docs/qa/BACKLOG.md`, `CLAUDE.md`; `recall` Graphify memory ("gotchas and decisions").
2. Pick the next batch: all critical, then major, then the top product features; at most 4 tasks per round, with no file overlap between tasks (use `graphify_file_neighbors` / `graphify_impact` to check).
3. Run each task with the Agent tool, choosing the model per task: `haiku` for copy/i18n/docs/mechanical fixes, `sonnet` for features and bug fixes, `opus` only for security fixes and the end-of-round review.
4. Each task must deliver: code + tests (unit, and e2e for user flows) + green `pnpm lint && pnpm typecheck && pnpm test`, DB tests, and the affected e2e specs.
5. End of round: one Opus review agent re-checks the round's diff for regressions and security; failures go back into the backlog.
6. Commit the round to branch `claude/manager` (one commit per task), update `BACKLOG.md` (status, evidence), `remember` new gotchas, push. The lead session merges to `main`, applies migrations and deploys.

## Definition of Done (stop when ALL hold)
- No open critical or major item in `BACKLOG.md`.
- Unit, DB and full e2e suites green twice in a row.
- Lighthouse ≥ 90 on /hy, /hy/check, /hy/login, /hy/app (performance, accessibility, best practices, SEO).
- Breaker re-test of all previously found security items: all fixed.
- Top 5 product features from `docs/qa/product.md` shipped, or explicitly deferred with a reason.
- Everything in `docs/QUALITY_BAR.md` "Done means" holds: four viewport sizes checked, axe-core clean (add `@axe-core/playwright` as a dev dependency in round 1), touch targets ≥ 44px, reduced motion respected.

## Limits
- At most 6 rounds; then stop and report what is left.
- Never: payments, invented article numbers, AI-generated people, pushing to `main`, applying migrations to the real database, real emails/Telegram messages.
- Minor items may be batched or deferred; never block DoD on cosmetics.
