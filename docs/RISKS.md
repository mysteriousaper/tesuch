# Hidden business risks (not yet covered)

Written 22 Nov 2026. Ordered by how badly each could hurt the business. "To verify" = needs a lawyer or provider check; nothing here is legal advice.

## Critical (fix before paying customers)
| # | Risk | Why it matters | Mitigation |
|---|---|---|---|
| R1 | **"Ready" sounds like a guarantee** | If an owner sees 🟢 Ready and an inspector still finds a violation, they will blame Tesuch (liability, refunds, reputation). Tesuch checks 13 rules; real inspections cover far more (pay, working hours, sick leave, documents on file, and the inspection body also covers health & safety). | Rename to "No known issues in what we check"; show "Tesuch checks 13 areas" with the list; liability cap in Terms (lawyer). |
| R2 | **Free-tier terms forbid commercial use** | Vercel Hobby is for non-commercial use only; charging customers on it breaks their terms (to verify current wording). | Move to Vercel Pro before the first paid customer (investor budget). |
| R3 | **No backups on Supabase Free** | One mistake or outage = all customer data lost; also the free project pauses after ~7 days without traffic (to verify) → site down. | Supabase Pro (daily backups, no pausing) before real data; meanwhile a weekly export script. |
| R4 | **Sign-in emails from a personal Gmail** | Google limits (~500/day) and may suspend automated sending; codes may land in spam → users can't log in. | Own domain + Resend (or similar) with SPF/DKIM before launch. |
| R5 | **Personal-data law: cross-border transfer** | Employee data (even as codes + birth dates) is still personal data; it goes to EU (Supabase) and US processors (Vercel, Telegram, Resend). Armenian law may require notification/consent for cross-border transfer (to verify with lawyer). | Lawyer checklist item; consent text; processor list on /security; codes by default (done). |

## High
| # | Risk | Mitigation |
|---|---|---|
| R6 | **Laws change, rules go stale** — no process watches arlis.am for amendments. | Monthly rule review by the partner lawyer; "rules last verified on <date>" shown in the app. |
| R7 | **Working-day maths ignores Armenian public holidays** (annual leave in working days, deadlines that fall on holidays). | Add a holiday calendar to the rules engine + tests. |
| R8 | **Garbage in, wrong status out** — wrong dates in an import give false "Ready". | Import sanity checks (impossible dates, future starts), "data last updated" age warning, quarterly "please re-upload" nudge. |
| R9 | **Channel conflict with accounting firms** — we now target their clients directly; they may advise clients against Tesuch. | Partner programme: firms get the multi-company mode for their clients (referral, co-branding). |
| R10 | **No legal entity / contract / invoices yet** — businesses won't share data with an individual's side project. | Register a company (or use an existing one), standard contract + DPA, manual invoicing. |
| R11 | **Willingness to pay is unproven** — SMEs often act only after a fine; many are rarely inspected. | Pilot with 5–10 firms, measure what they fix; position around concrete triggers (new hires, contract endings, inspection campaigns). |

## Medium
| # | Risk | Mitigation |
|---|---|---|
| R12 | **Bus factor / maintainability** — the code was built by AI agents; nobody on the team can maintain it alone yet. | Keep docs/tests up to date (done); find a part-time developer before launch. |
| R13 | **Development speed tied to one Claude Pro plan** (weekly limits pause work). | Plan releases around the limit; budget for a higher plan once revenue starts. |
| R14 | **Brand trust: `*.vercel.app` address** looks unofficial. | Own `.am` domain (investor budget). |
| R15 | **Support** — one Gmail inbox, no hours, no response promise. | Telegram support chat + stated response time. |
| R16 | **Competitors** — ArmSoft/1C or the SRC e-platform could add simple deadline alerts. | Stay ahead on what they won't do: readiness for the whole inspection, plain language, Telegram, done-for-you setup. |
| R17 | **Armenian legal wording** in UI/PDFs written by AI may contain subtle errors. | Lawyer/native editor review of PDFs and rule texts. |
