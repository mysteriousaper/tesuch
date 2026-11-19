# Security review: arena lanes A–E

_Judge pass, 2026-11-19, branch `claude/gallant-dijkstra-unyblc` (all lanes merged, HEAD `0d0587d`). Code read in full. `pnpm lint`, `pnpm typecheck` and `pnpm test` (218 unit tests) pass. `supabase/tests/run.sh` passes: RLS cross-tenant, lane C quiz, lane D leads and the demo seed, on Postgres 16._

Only findings with confidence of 8/10 or more and a concrete exploit path are reported.

## Findings

### S-1 (Low, abuse): lead capture can be flooded with unlimited fake leads
- **Where:** `supabase/migrations/20261118040000_leads.sql:46-48` (throttle), `:64` (grant to `anon`); `src/app/[locale]/check/actions.ts:23-45`.
- **What:** `submit_lead` is executable by `anon`, and the anon key ships to every browser. The only throttle is "same email within 10 minutes". Nothing limits by IP or overall rate.
- **Exploit:** loop `POST https://<project>.supabase.co/rest/v1/rpc/submit_lead` with the public anon key and a new random address each time (`r1@x.io`, `r2@x.io`, …), `p_consent: true`. Each call stores a row of up to about 4 KB (`answers` is capped at 4096 bytes, other fields are clamped). The server action can be looped the same way. Result: the sales lead list fills with junk and storage grows without limit.
- **Fix:** add a global or per-IP throttle. One option is an `x-forwarded-for`-keyed counter checked in the server action, with `execute` on the RPC revoked from `anon` and the RPC called with the service role. Another is a coarse DB-side cap, such as refusing more than N leads per minute. Also recompute `score` on the server with `scoreAnswers()` rather than trusting the client value (`check/actions.ts:12,36`). That is a data-integrity issue, not an exploit.

No other finding met the bar.

## What was checked (no issue found)

| Area | Code | Result |
|---|---|---|
| Tenant isolation, client-sent ids (lane A) | `src/app/[locale]/app/actions.ts` | `org_id` always comes from the DB row the user can see under RLS (`editableCompany`, `editableOrg`), never from the client. Bound ids (`companyId`, `employeeId`, `contractId`, `findingId`, `orgId`) are uuid-checked (except `companyId` in `setFindingStatus`, which is only an extra filter) and used only as filters: an employee must be in the editable company and a contract must belong to that employee (`:276-282`). `addLeave` checks the employee belongs to the company (`:237`). `setFindingStatus` relies on the `findings_update` RLS (`can_edit`) and the status-only trigger, so a viewer or outsider updates 0 rows. `renameOrg` uses the owner-only `orgs_update` RLS. Composite FKs block cross-org rows even if a check were missed. |
| Role checks (owner/accountant/viewer) | A `canEdit`/`editableOrg`; B `import/actions.ts:67-69`; C `quiz/actions.ts:35-36` | Every write path checks owner or accountant before writing. Every service-role use (rule runs in A and B, the quiz insert in C, member emails in A's settings) happens **after** that check and is scoped to the checked company or org. The UI hides edit controls for viewers, and the server enforces the same rule independently. |
| Org cookie | `actions.ts:52-56,75-83`, `dashboard/pick-org.ts` | httpOnly, SameSite=Lax. It is only set for an org the user belongs to, and it is re-validated against memberships on every read. It is a preference, never an authorisation. |
| Settings member emails | `settings/page.tsx:27-37` | Memberships are read via RLS for the current org only, and `auth.admin.getUserById` is called only for those ids. Members see their co-members' emails, which is the intended behaviour. |
| Import (lane B) | `import/actions.ts` | Payload re-validated with zod: uuid, header, row and column caps, cell sizes, mapping keys numeric and in range, target fields enum-checked and unique, required fields present. The file is re-parsed on the server (`buildImport`), so client preview data is not trusted. Inserts go through the user's RLS client. The company and org come from the DB. |
| PDF route tenancy (lane C) | `src/app/api/pdf/**` | Every read uses the signed-in user's RLS client. Another org's contract or company resolves to 404, and an unauthenticated request gets 401. Ids and dates are zod-validated. The filename is ASCII-sanitised. The response is `private, no-store`. GET-only and read-only, so CSRF does not apply. |
| Quiz scoring (lane C) | `quiz/actions.ts`, `20261118030000_quiz.sql` | `authenticated` has no insert, update or delete grant on `quiz_attempts`. The server recomputes questions and the score from the server's own pick. Correct answers are never sent to the client (`quiz-form.tsx` `ClientQuestion`). Unique `(company_id, iso_week, user_id)` and a composite FK. Verified by `supabase/tests/lane_c.sql`. |
| Leads table (lane D) | `20261118040000_leads.sql` | RLS on with no policies, and all privileges revoked from anon and authenticated, so nobody can read leads via the API (verified by `lane_d.sql`). `submit_lead` is `security definer` with `search_path = ''`. It validates consent, email, locale and the answers type, clamps lengths and scores, and caps the jsonb size. No SQL injection: there is no dynamic SQL. See S-1 for abuse. |
| Theme cookie script (lane D) | `src/components/theme/config.ts:26`, `src/app/[locale]/layout.tsx:40` | `MODE_SCRIPT` is a static string with no interpolation of request data. The cookie value is matched by `(light|dark)`, so only those literals reach `setAttribute`. No injection path. |
| XSS / manual HTML | all lane code | The only `dangerouslySetInnerHTML` is the static theme script. No hand-built HTML strings. User data (names, company names) is rendered through React or react-pdf. External links use `rel="noopener noreferrer"`. The OG image uses JSX with no user input. |
| Injection | all lane code | supabase-js query builder only, values URL-encoded by PostgREST. No raw SQL in app code. The migrations use no dynamic SQL. |
| Secrets | repo, tests | No keys in the repo. The service key is read only from env (`src/lib/env.ts`, `tests/e2e/helpers/supabase.ts`) and only server-side (`server-only` / `"use server"` modules). E2E test users are throwaway `qa-e-*` accounts deleted in teardown. |
| Open redirect | new links / actions | No new redirect targets come from user input. Covered for the auth callback by `tests/e2e/api.spec.ts`. |

## Informational (below the reporting bar or by design)
- `submit_lead` returns a distinct "throttled" error. This reveals whether a given address submitted the self-check in the last 10 minutes. The impact is negligible.
- `revalidatePath` receives a client-supplied `locale` in several actions (A, B). At worst this revalidates a non-existent path. Harmless.
- `playwright.config.ts:27` sets `ignoreHTTPSErrors` only when an egress proxy is configured, for sandbox use only. Do not set `HTTPS_PROXY` in CI.
