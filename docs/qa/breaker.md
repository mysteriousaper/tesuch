# QA war: breaker report

_Fighter "breaker", 2026-11-19, branch `claude/qa-breaker` at base `3cccb37`. Target: a local production build (`pnpm build && NODE_USE_ENV_PROXY=1 pnpm start -p 3303`) against the real Supabase project `fbzzhtfakcwnwfuxrqsi`, plus throwaway Postgres for anything that would be a denial of service on the live project. All accounts were throwaway `qa-e-breaker-*` users created with the service role and deleted afterwards (`docs/qa/breaker/check-leftovers.mjs` reports 0 users and 0 orgs left). No real email was sent, no Telegram message was sent (`TELEGRAM_BOT_TOKEN` unset locally, fake chat ids), and no lead rows were written to the live database._

## Summary

| Severity | Count | Findings |
|---|---|---|
| Critical | 1 | B-1 |
| Major | 4 | B-2, B-3, B-4, B-5 |
| Minor | 4 | B-6, B-7, B-8, B-9 |

None of these duplicates `docs/ARENA.md` or `docs/SECURITY_REVIEW.md`. B-4 is a new problem created by the S-1 fix (`20261119010000_leads_throttle.sql`), not S-1 itself.

## How to reproduce

All scripts are in `docs/qa/breaker/`. The live probes need the app on `http://localhost:3303` (override with `APP_URL`) and a `.env.local` as in `.env.example`.

```bash
pnpm build && NODE_USE_ENV_PROXY=1 pnpm start -p 3303 &
NODE_USE_ENV_PROXY=1 node --env-file=.env.local docs/qa/breaker/p1-postgrest.mjs   # PostgREST tenancy + roles
NODE_USE_ENV_PROXY=1 node --env-file=.env.local docs/qa/breaker/p2-app.mjs         # routes, org cookie, B-1, B-3
NODE_USE_ENV_PROXY=1 node --env-file=.env.local docs/qa/breaker/p3-flows.mjs       # invitations, consent gate, server actions
NODE_USE_ENV_PROXY=1 node --env-file=.env.local docs/qa/breaker/p4-input.mjs       # hostile names through pages/PDF/export
NODE_USE_ENV_PROXY=1 node --env-file=.env.local docs/qa/breaker/p5-redirect-allowlist.mjs  # B-2 (no email sent)
NODE_USE_ENV_PROXY=1 node --env-file=.env.local docs/qa/breaker/p6-telegram.mjs    # webhook with forged updates
runuser -u postgres -- bash docs/qa/breaker/db-run.sh                               # B-1, B-3, B-4 on throwaway Postgres
NODE_USE_ENV_PROXY=1 node --env-file=.env.local docs/qa/breaker/check-leftovers.mjs
```

Each script prints `HELD` or `BROKE` per check and cleans up in a `finally` block. The output of the recorded run is next to each script (`p*-output.txt`, `db-output.txt`).

---

## B-1 (Critical): an owner can add any user to their org, backdated, and capture the data that user types

**Where:** `supabase/migrations/20261118000000_init.sql:286-288` (`memberships_owner_write ... for all`), default table grants (authenticated has `insert` on every column of `memberships`, including `created_at`), `src/components/dashboard/queries.ts:20` (first org = oldest `created_at`), `src/components/dashboard/pick-org.ts:10`.

**What:** the owner write policy covers `INSERT`, so an owner can insert a membership row for *any* `user_id`, with any role and any `created_at`. The victim never sees or accepts an invitation. When the victim has no `tesuch_org` cookie (new browser, new device, cleared cookies, cookie expired), the app opens their *oldest* membership, which the attacker set to the year 2000. If the attacker also renames their org to the victim's firm name, the victim works in the attacker's tenant without noticing, and every company and employee they add is readable by the attacker. If the attacker adds the victim as `viewer`, the victim cannot even leave: only owners may delete membership rows.

**Prerequisite:** the victim's user id. It is shown to anyone who ever shared an org with the victim (`memberships.user_id`, `audit_log.actor`, `invitations.accepted_by`), for example a former colleague or a client company that was once in the same org. As a side effect the attacker also learns the victim's email from the members page and the org export (`emailsFor`).

**Steps (live, `p2-app.mjs`):**
1. Owner A creates org "Breaker A" and a company "Co A". Victim creates their own org "Victim Audit LLC".
2. As A (user JWT): `insert into memberships (user_id, org_id, role, created_at) values (<victim>, <orgA>, 'owner', '2000-01-01')`, then `update orgs set name = 'Victim Audit LLC' where id = <orgA>`.
3. Victim opens `GET /en/app` without an org cookie.
4. Victim adds a company "Victim client Ltd" in the org the app shows.

**Expected:** step 2 is refused. Memberships are only created by `create_org()` and `accept_invitation()`.
**Actual:**
```
BROKE  owner A force-adds victim as owner, backdated  :: inserted
BROKE  victim's default org after forced add  :: victim dashboard lists attacker company Co A: true
   victim insert into default org: ok | attacker reads it: [{"name":"Victim client Ltd"}]
```
The same path reproduces on plain Postgres (`db-output.txt`: "victim's first org (order by created_at) is the attacker's look-alike org").

**Fix:** new migration (Engineering prefix):
```sql
drop policy memberships_owner_write on public.memberships;
revoke insert, update on public.memberships from authenticated;
grant update (role) on public.memberships to authenticated;          -- members/actions.ts:91 only updates role
create policy memberships_owner_update on public.memberships for update to authenticated
  using (private.has_role(org_id, array['owner']::public.member_role[]))
  with check (private.has_role(org_id, array['owner']::public.member_role[]));
create policy memberships_delete on public.memberships for delete to authenticated
  using (private.has_role(org_id, array['owner']::public.member_role[]) or user_id = (select auth.uid()));  -- members can leave; keep_one_owner still guards the last owner
```
`create_org()` and `accept_invitation()` are `security definer` and keep working. No app code inserts memberships with the user client (checked with `grep 'from("memberships")'`). Add a `supabase/tests/dept_eng.sql` case: an owner inserting a membership for another user must fail.

---

## B-2 (Major): the Auth redirect allow-list trusts a Vercel domain anyone can register, so a password-recovery email can hand a session to an attacker

**Where:** Supabase Auth settings of project `fbzzhtfakcwnwfuxrqsi` (Dashboard → Authentication → URL Configuration): `uri_allow_list` contains `https://tesuch-*-samvel-hovsepyan-4774.vercel.app/**`. The `recovery`, `invite` and `email_change` email templates contain `{{ .ConfirmationURL }}` (the magic-link and confirmation templates only contain `{{ .Token }}`, so normal sign-in is not affected).

**What:** in Supabase's glob, `*` matches any characters except `.` and `/`. `tesuch-anyone-samvel-hovsepyan-4774.vercel.app` matches the pattern, and a Vercel *project* named `tesuch-anyone-samvel-hovsepyan-4774` gets exactly that production domain. An outsider can create such a project on their own Vercel account. They then call the public `POST /auth/v1/recover?redirect_to=https://tesuch-anyone-samvel-hovsepyan-4774.vercel.app/x` with the public key and the victim's email. The victim gets a genuine "reset" email from Tesuch's sender. If they click it, Supabase verifies the token and redirects to the attacker's page with the session tokens in the URL fragment. The attacker is then signed in as the victim.

**Steps (`p5-redirect-allowlist.mjs`, uses `admin.generateLink`, which returns the link and sends no email):**
```
BROKE  recovery link redirect_to=tesuch-anyone-samvel-hovsepyan-4774.vercel.app  :: action_link redirect_to=https://tesuch-anyone-samvel-hovsepyan-4774.vercel.app/steal
BROKE  magiclink link redirect_to=tesuch-anyone-samvel-hovsepyan-4774.vercel.app  :: action_link redirect_to=https://tesuch-anyone-samvel-hovsepyan-4774.vercel.app/steal
HELD   recovery link redirect_to=evil.example  :: action_link redirect_to=http://localhost:3000
```
**Not exercised:** sending the email and registering the look-alike Vercel project. Both are outside the war rules (no real email, no third-party accounts). The allow-list acceptance, which is the part Tesuch controls, is proven above.

**Expected:** only Tesuch's own hosts are accepted as `redirect_to`.
**Fix:**
1. Replace the wildcard with exact hosts: `https://tesuch.vercel.app/**`, plus individual preview hosts only while they are needed. Sign-in uses the 8-digit code, so previews do not need redirects at all.
2. Remove `{{ .ConfirmationURL }}` from the recovery and invite templates (the app has no passwords and no Supabase-sent invites), or replace them with `{{ .Token }}` text.
3. Record this in `docs/RUNBOOK.md` next to the SMTP settings.

---

## B-3 (Major): "erase for good" leaves the employee's name and birth date in the audit log

**Where:** `supabase/migrations/20261118000000_init.sql:217-236` (`private.audit()` stores `to_jsonb(old)` and `to_jsonb(new)` for every row), `:239` (trigger on `employees`, `contracts`, `leave_records`, …), `:315` (owners may read `audit_log` through the API), `src/app/[locale]/app/members/actions.ts:111` (`deleteEmployee`). The UI promises "Download what Tesuch stores about an employee, or erase it for good." (`messages/en/members.json` `data.intro`, `data.deleteBody`; same in `hy`/`ru`).

**Steps (live, `p2-app.mjs`):** owner creates employee "Anna Secret", born 1990-05-05, deletes the employee (same delete as `deleteEmployee`), then reads `audit_log` with their own JWT.
**Expected:** no personal data of the erased employee remains readable.
**Actual:**
```
BROKE  erased employee's name/birth date gone from audit_log  :: deleted 1 employee; audit old_row still has full_name+birth_date: true
   audit rows still containing the name: 2 employees
```
The `insert` row (`new_row`) and the `delete` row (`old_row`) both keep the full name and birth date. Any owner can read them through PostgREST (`select old_row from audit_log`) indefinitely. `audit_log` also has no foreign key to `orgs`, so deleting an org leaves all its audit rows in place (the test helpers delete them by hand for this reason: `tests/e2e/helpers/supabase.ts:69`). The DPA draft (`docs/legal/DPA_DRAFT.md`) and the erasure UI therefore overstate what is deleted.

**Fix (pick one, lawyer to confirm retention, LAWYER_CHECKLIST item 26):**
- In `private.audit()` (`init.sql:217`), stop storing personal columns: for `employees` strip `full_name`, `birth_date` and `external_ref` from `old_row`/`new_row` (`r - 'full_name' - 'birth_date' - 'external_ref'`), and keep only ids and the list of changed column names. Or:
- add an `after delete on public.employees` trigger that runs `update public.audit_log set old_row = null, new_row = null where table_name = 'employees' and row_id = old.id::text` (plus the employee's `contracts` and `leave_records` rows). In both cases add `on delete cascade` on an `audit_log.org_id` FK to `orgs`, or purge it when an org is deleted.

---

## B-4 (Major): 30 junk submissions per hour shut the free self-check lead form for everyone

**Where:** `supabase/migrations/20261119010000_leads_throttle.sql:35-36` (global cap `>= 30` per rolling hour), `src/app/[locale]/check/actions.ts:28` (`submitLead`, anonymous, no per-IP limit, no captcha).

**What:** the S-1 fix replaced "unlimited junk" with "a global cap of 30 leads per hour". `submitLead` is a public server action, and each new random address passes the per-email throttle. So 30 requests per hour (one every two minutes) are enough to make every real prospect see "try later", around the clock. The attack needs no account and no key.

**Steps:**
- Live (no write): `p3-flows.mjs` calls the action without a session using its action id from `.next/server/server-reference-manifest.json`: `HTTP 200 1:{"ok":false,"reason":"invalid"}`. Anyone can reach the action, and the only throttles are inside the RPC.
- Lock-out (throwaway Postgres, `db-run.sh`; not run live because it would be a denial of service against the real lead form):
```
BROKE lead cap: after 30 junk leads a real prospect is refused with P0429 (UI: "try later") for the rest of the hour
```
**Expected:** a flood from one source does not block other visitors.
**Fix:** throttle per client before the global cap. In `check/actions.ts:28`, read the first `x-forwarded-for` address (Vercel sets it), HMAC it with a server secret (as `ipHash()` in `src/components/legal/consent.ts` already does), and pass it to `submit_lead` as a new `p_ip_hash` parameter. In the RPC, refuse more than 3 per IP hash per hour. Keep the global cap as a safety net but raise it well above normal traffic (for example 500 per hour), and add a honeypot field to the form. Store the hash in a new nullable `leads.ip_hash` column.

---

## B-5 (Major, configuration; lock-out not triggered on purpose): one anonymous script can block all sign-ins for an hour

**Where:** Supabase Auth settings: `rate_limit_email_sent = 30` (emails per hour for the whole project), `security_captcha_enabled = false`, `disable_signup = false`. `src/app/[locale]/login/login-form.tsx:24` calls `signInWithOtp({ shouldCreateUser: true })` straight from the browser with the public key.

**What:** sign-in is email-code only, so every login needs one email. The project-wide budget is 30 emails per hour, and nothing stops an anonymous caller from spending it: `POST /auth/v1/otp` with 30 random addresses. After that, every real user's "send code" fails with "email rate limit exceeded" until the window rolls over. Repeating this every hour keeps everyone out. Each call also creates a junk `auth.users` row and sends mail from the configured SMTP account, which hurts the sender's reputation.

**Evidence:** the settings above were read from `GET https://api.supabase.com/v1/projects/fbzzhtfakcwnwfuxrqsi/config/auth` (read-only). The lock-out itself was **not** triggered: that would be a denial of service, and it would send real email, which the war rules forbid.

**Fix:** enable Supabase CAPTCHA (Turnstile or hCaptcha) and pass `options.captchaToken` in `login-form.tsx:24`. Raise `rate_limit_email_sent` to what the SMTP provider allows. Consider `shouldCreateUser: false` on the login page, and create accounts only from a sign-up form that also has a CAPTCHA.

---

## B-6 (Minor): invitations survive the demotion or removal of the owner who created them

**Where:** `supabase/migrations/20261119020000_members.sql:61-79` (`accept_invitation` checks the token, expiry, use and email, but not whether the inviter is still an owner), `src/app/[locale]/app/members/actions.ts:85-109` (`changeRole`, `removeMember` leave the person's invitations alone).

**Steps (`p3-flows.mjs`):** owner O invites `other` as **owner**. A second owner demotes O to viewer. `other` accepts.
**Actual:** `BROKE  invite created by a since-demoted owner stays valid  :: inviter now viewer; invitee joined as owner`.
**Expected:** when an owner is demoted or removed, the pending invitations they created are revoked. Otherwise a departing owner can invite a second address of their own just before being removed and come back as owner within 7 days.
**Fix:** in `accept_invitation` (`members.sql:72`), add `if not exists (select 1 from public.memberships where org_id = v_inv.org_id and user_id = v_inv.invited_by and role = 'owner') then raise exception 'invitation revoked'; end if;`. Also, in `private.keep_one_owner` or a new `after update or delete on memberships` trigger, delete open invitations where `invited_by = old.user_id` when `old.role = 'owner'` and the new role is not owner.

---

## B-7 (Minor): the consent gate is enforced only by the `/app` layout; the API, route handlers and exports work without accepted Terms

**Where:** `src/app/[locale]/app/layout.tsx:21` is the only check. Not checked: `src/app/api/pdf/_lib/load.ts:19` (`userClient`), `src/app/[locale]/app/members/data/export/route.ts:9`, `.../employees/[eid]/route.ts`, every server action, and PostgREST (no RLS condition on consent). `supabase/migrations/20261119030000_consent.sql:25` lets the client choose `ip_hash`.

**Steps (`p3-flows.mjs`, user created without consent records):**
```
HELD   consent gate: /app redirects unconsented user  :: 307 -> /en/consent
BROKE  consent gate: unconsented user writes tenant data via API  :: org …, company …
BROKE  consent gate: unconsented owner downloads org export route  :: HTTP 200 attachment; filename="tesuch-org-no-consent-org-2026-11-19.json"
BROKE  consent gate: unconsented user renders PDF  :: HTTP 200 application/pdf
BROKE  consent evidence: client chooses ip_hash  :: row stored with ip_hash=aaaa…
```
**Impact:** Tesuch processes employee personal data for users who never accepted the Terms and Privacy notice. The consent record is meant as evidence, but its `ip_hash` can be any 64-hex string the client chooses.
**Fix:** move the gate into the database for writes. Add `private.has_consent()` (a `security definer` function that checks `consent_records` for the current `GATE_DOCUMENTS` versions, with the versions kept in a small `legal_versions` table) and `and private.has_consent()` to the insert/update policies and to `create_org()`. Call `hasCurrentConsent` in `userClient()` (`load.ts:19`) and in both export routes. Change `consent.sql:25` to `grant insert (user_id, document, version)` and set `ip_hash` only from the server: the `recordConsent` action would need the service role for that one column, or a `security definer` RPC that takes the hash.

---

## B-8 (Minor): no Content-Security-Policy

**Where:** `next.config.ts:14-20`. **Actual:** `BROKE  Content-Security-Policy header on HTML :: missing` (`p2-app.mjs`). No XSS was found (see below), so this is defence in depth. The app has one inline script (`MODE_SCRIPT`), which a nonce or hash can cover.
**Fix:** add `Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-<hash of MODE_SCRIPT>'; connect-src 'self' https://fbzzhtfakcwnwfuxrqsi.supabase.co; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` to the `headers()` list. Start as `Content-Security-Policy-Report-Only` for a week. HSTS is also absent locally, but Vercel adds it in production, so it is not reported.

## B-9 (Minor): the production Auth `site_url` is `http://localhost:3000`

**Where:** Supabase Auth settings (`site_url`). **Evidence:** `p5-redirect-allowlist.mjs`: a link with a non-allowed `redirect_to` falls back to `redirect_to=http://localhost:3000`. Any Supabase email that relies on the default (email change confirmation, a future invite or recovery mail) sends real users to localhost.
**Fix:** set `site_url` to `https://tesuch.vercel.app` (Dashboard → Authentication → URL Configuration).

---

## What held (tried, not broken)

| Area | Checks (script) |
|---|---|
| Cross-tenant reads via PostgREST | 14 tables read with another tenant's JWT: 0 foreign rows; `leads` is permission denied (p1) |
| Cross-tenant writes | Forged `company_id` blocked by the composite FK. Update or move of another org's employee, company or org: 0 rows. Self-insert as owner of another org and inviting oneself into it are refused by RLS (p1) |
| Role escalation | Viewer or accountant self-promotion: 0 rows. Accountant cannot invite, read tokens or read the audit log. Viewer cannot write or delete (p1) |
| Last-owner guard | Sole owner demote, remove, and moving the membership row to another org are all refused (p1) |
| Invitations | Wrong email refused, token reuse refused, expired refused, upper-case or padded email rejected by the check constraint, guessed token gives an empty preview, SQL-ish token gives "not found" (p1, p3) |
| RPC exposure | anon `create_org`, `create_telegram_link_token` and `submit_lead` → 401. Authenticated `submit_lead` → permission denied (S-1 fix holds) (p1) |
| Consent records | Insert for another user and rewriting one's own record are both refused (p1) |
| PDF routes | All 4 routes: owner 200 PDF, other tenant 404, anonymous 401 (p2) |
| Exports | Employee export by another tenant → 404. Org export by a viewer → 403. A forged `tesuch_org` cookie gives the caller's own org only (p2) |
| Org cookie | Dashboard with the cookie forged to another org shows the caller's own org (p2) |
| Nightly job, webhook, health | No or wrong `CRON_SECRET` → 401. Webhook without secret → 401. `/api/health` shows no secrets or hosts (p2) |
| Auth callback open redirect | `//evil.com`, `/hy//evil.com`, `https://evil.com`, `/\evil.com`, encoded traversal, CRLF and `..` all stay on the origin (p2) |
| Server actions without a session | `recordConsent` → forbidden (p3) |
| Hostile input | `<script>`/`onerror` names, RTL override, `=HYPERLINK(...)`, 200 Armenian characters, astral and zero-width characters: PDFs render (200), page HTML is escaped, export filenames are ASCII-slugged. Exports are JSON, not CSV, so there is no spreadsheet formula path (p4) |
| Telegram webhook (valid secret, forged updates) | Group chat and bot sender cannot link. Link token is single use. Malformed or invalid JSON → 200 with no crash (p6). Reply HTML goes through `escapeHtml` and `fit()` drops whole entries rather than cutting tags (code read) |
| Secrets in the client bundle | `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` and `TELEGRAM_WEBHOOK_SECRET` values: 0 hits in `.next/static`. Only the publishable key is present, as intended |
| Theme cookie script | Static string; the cookie is matched by `(light|dark)` (code read, as in SECURITY_REVIEW) |
| Import | Zod caps (rows, 60 columns, 2000-character cells), server re-parse, role check before writing (code read; the server action body limit is the Next.js default of 1 MB) |

## Cleanup
Every probe deletes its orgs (cascade), the orgs' audit rows and its users in `finally`. Telegram test links are deleted by chat id. `docs/qa/breaker/check-leftovers.mjs` printed `breaker users left: 0`, `breaker orgs left: 0` after the last run. `.env.local` is gitignored and not committed.
