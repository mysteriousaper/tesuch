# Pricing (DRAFT)

> **DRAFT: the human decides later. There are no payments in the product.** Billing, if any, happens manually and outside the app (invoice + bank transfer). All figures marked "to verify" must be checked before they appear in any sales material.

## Tiers (proposal)
| Tier | For | What's included | Price idea |
|---|---|---|---|
| **Free** | Any company trying it | 1 company, all rules, findings, score, email alerts | Free forever |
| **Firm** | Accounting/outsourcing firms | Unlimited users; priced **per client company** per month; firm dashboard, Telegram + email alerts, weekly digests, PDF orders, quiz | Per-company price, volume discount from 20+ companies (amount to decide) |
| **SME** | A company managing its own HR | 1 company, up to N employees, Telegram digest, PDF orders | Flat monthly (amount to decide) |
| **Pilot** | First 10 accounting firms | Full Firm tier **free for 60 days**, in exchange for feedback calls and a testimonial if satisfied | Free |

Keep pricing in AMD, invoiced monthly or yearly (yearly = 2 months free).

## Why customers would pay: one fine vs a year of Tesuch
The argument: **a single labour-inspection penalty, back-pay claim or reinstatement case at one client can cost more than a year of Tesuch for the whole firm.**

| Item | Value |
|---|---|
| Typical penalty range for labour-law violations found during an inspection | **to verify with a lawyer** (from the Code on Administrative Offences and the inspectorate's practice) |
| Cost of a wrongful-dismissal dispute (back pay, reinstatement, legal fees) | **to verify** |
| Hours an HR accountant spends checking deadlines per client per month | **to verify in pilots** (estimate first, then measure) |
| Tesuch cost per client company per year | price × 12 |

Do not use any fine amount in marketing until it is verified and sourced.

## Free-tier cost model (our own costs)
> **Check current limits** on each provider's pricing page before relying on these; they change.

| Service | Free limit (as of drafting) | What we consume | When it forces a paid plan |
|---|---|---|---|
| **Supabase Free** | 500 MB database, 50,000 monthly active users, **project pauses after 7 days of inactivity**, no daily backups | ~1–2 KB per employee incl. contracts, leave and findings, plus the audit log (the biggest grower) | **Before the first paying customer**: pausing and no backups are unacceptable for real data. On size alone: roughly 100k+ employees, or earlier if the audit log isn't pruned. |
| **Vercel Hobby** | **Non-commercial use only**; cron at most once a day; function time limits | App hosting, daily nightly job | **As soon as we charge money** (licence terms), or if the nightly job outgrows function time limits (batch per company; fallback is Supabase pg_cron). |
| **Resend Free** | 3,000 emails/month, 100/day | Alerts + weekly digest per user | Around **100 active users** receiving a weekly digest plus alerts, or any day with more than 100 alerts. Telegram (free) absorbs most alerts. |
| **Telegram Bot API** | Free | Alerts, digests | No paid tier needed; watch rate limits (~30 messages/second). |
| **GitHub Free** | Private repos, Actions minutes per month | CI | Unlikely in the MVP. |

**Rule of thumb:** move to Supabase Pro and Vercel Pro at the moment the first firm pays (fixed monthly cost, to verify). Pricing must cover that with 3–5 paying firms.
