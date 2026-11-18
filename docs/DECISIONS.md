# Decisions log

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-11-18 | Third-party plugins from the master prompt (ECC, claude-video) and extra MCP servers are **not installed**. Built-in review, security, test and subagent tooling is used instead. | Unvetted third-party code with broad access; existing tools cover the same roles. Approved by the human. |
| 2 | 2026-11-18 | Video research (`/watch`) replaced by docs-based notes. | YouTube is blocked in the build environment; official docs are more precise and current. |
| 3 | 2026-11-18 | **All 12 seed rules are `needs_lawyer_review`**, including the five the brief calls "verified". | They come from a law-firm summary, not arlis.am. Ground rule 4: only verified rules may raise red. |
| 4 | 2026-11-18 | No payments in the product; pricing deferred. | Human decision. |
| 5 | 2026-11-18 | Lean orchestration: one lead agent writes the code, with subagents for parallel or independent review work, instead of 12 standing agents. | Cost and coordination overhead for an MVP. |
| 6 | 2026-11-18 | Thresholds (months, days, tiers) live in rule JSON as fact parameters; date maths lives in TS. | A legal change becomes a rule version bump, reviewed as data. |
| 7 | 2026-11-18 | Last allowed probation day = start + N months − 1 day (date-fns month clamping). | Common reading; flagged for lawyer confirmation in rule edge cases. |
| 8 | 2026-11-18 | Score = 100 − Σ penalty (red 20, amber 8, advisory 4, info 0), doubled if overdue, floored at 0. Firm score = mean of company scores. | Simple and explainable to a firm partner. Revisit with pilot feedback. |
| 9 | 2026-11-18 | `org_id` denormalised plus composite FKs `(parent_id, org_id)`. | RLS stays a cheap single-column check, and cross-tenant parent links are impossible at the schema level. |
| 10 | 2026-11-18 | Nightly job on Vercel Cron (Hobby: daily) calling a Next.js route; pg_cron is the fallback. | Rules engine is TypeScript; one runtime for app and job. |
| 11 | 2026-11-18 | RLS tests run on plain Postgres with a small Supabase shim, not the Supabase CLI. | No Docker daemon or Supabase network access in the build environment; fast and runs in free CI. |
| 12 | 2026-11-18 | Next.js 15 (not 16). | Stable with next-intl and the current shadcn setup; upgrade later. |
