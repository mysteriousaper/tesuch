# Investor requests and outside-the-code work

Nothing here is adopted until approved in writing.

## Needed now (free)
| Item | Why | Status |
|---|---|---|
| Supabase account + project in an **EU region** (Free) | Database, auth | ⏸ waiting |
| Vercel account (Hobby) | Hosting, preview deploys, daily cron | ⏸ waiting |
| Telegram bot via @BotFather | Alerts and weekly digest | ⏸ waiting |
| Resend account (Free) | Email alerts | ⏸ waiting |
| A sample ArmSoft HR/staff export (anonymised) | Import preset | ⏸ waiting |

## Legal (blocking any "red" alert)
| Item | Why |
|---|---|
| **Armenian labour lawyer** to verify all 12 rules against arlis.am (article, wording, edge cases, exact source link) | Until then every finding is advisory only. Checklist in `docs/RULES_MATRIX.md`. |
| Article numbers for: annual leave, leave-to-cash ban, notice periods, maternity leave, SRC registration | Missing in the brief; we do not invent them. |
| **SRC e-contract deadline: 1 Jan 2026 or 1 Jul 2027?** Plus any SRC (ՊԵԿ) integration options | Decides whether `src-registration` can ever be more than a risk flag. |
| Consent text + DPA template under the Law on Personal Data Protection | Drafts to come; must be lawyer-reviewed. |
| Must the Personal Data Protection Agency be notified? | Compliance before the first real customer data. |
| "Not legal advice" disclaimer wording (hy/ru/en) | Shown on every advisory finding. |
| Lawyer partnership on revenue share | Sales channel and credibility. |

## Later budget
- `.am` domain
- Supabase Pro (daily backups, no pausing after inactivity): needed before paying customers
- Logo and identity designer
- Pilot programme: 3 accounting firms

## Risks
| Risk | Mitigation |
|---|---|
| Legal liability for a wrong alert | Advisory-only until verified; disclaimer; versioned rules; lawyer sign-off logged |
| ArmSoft adds deadline alerts | Focus on multi-company firm dashboard, score and Telegram; integrate rather than compete |
| Free-tier limits (Supabase pauses after 7 days idle, 500 MB DB; Vercel Hobby is non-commercial, daily cron only) | Move to paid plans before charging customers; cost model in `docs/gtm/PRICING.md` (later) |
| Personal data breach | RLS + composite FKs + audit log, tested in CI; minimal data stored |
