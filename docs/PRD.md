# Tesuch (Տեսուչ) — PRD

## Problem
Armenian employers learn about labour-law gaps during an inspection, when it is too late. HR data lives in ArmSoft exports and spreadsheets, and nobody tracks deadlines such as probation ends, fixed-term contract ends or notice periods. Accounting firms that run HR paperwork for 20–50 client companies carry this risk for every one of them.

## Promise
"Would you pass a labour inspection today?" A score from 0 to 100 per company, a timeline per employee, and an alert before a legal deadline is missed.

## Personas
| Persona | Context | Job to be done | Win |
|---|---|---|---|
| **Anna, partner at an accounting firm** (payer) | 30 client companies, 2 HR accountants | "Show me which clients are at risk this week, so I can fix it before they or an inspector notice." | One dashboard sorted by score; fewer emergencies |
| **Karen, SME owner** (10–100 staff) | Doesn't read the Labour Code, uses Telegram all day | "Tell me in one message if I have a problem and what to do." | Weekly Telegram digest with 1–3 "fix this" tasks |
| **Lilit, HR accountant** | Does the paperwork | "Give me the right order template in Armenian, then let me tick it done." | PDF order in 1 click; finding closes |

## Jobs (MVP scope)
1. Import staff from CSV/Excel, with a column-mapping wizard and an ArmSoft preset when we get a sample export.
2. Calculate legal deadlines (probation, fixed-term end, notice, leave).
3. Nightly deterministic rule run → findings.
4. Alerts by Telegram and email; weekly digest.
5. Inspection-Ready Score per company and per firm.
6. PDF orders and checklists (Noto Sans Armenian).
7. Weekly "surprise inspection" quiz, plus streaks and badges for a clean record.

## Success metrics (first 90 days)
- Activation: first import within 24 h of sign-up, for ≥ 60 % of firms.
- 10 pilot firms, ≥ 6 weekly active after 30 days.
- ≥ 50 % of red/advisory findings marked fixed within 14 days.
- Median company score rises ≥ 15 points within 60 days.

## Non-goals
- **No payments or billing in the product.** Pricing is a sales-docs decision for later.
- No AI chatbot or legal advice. The legal logic is explicit, versioned, tested rules.
- No payroll, timesheets or salary data in the MVP. That means no overtime, working-time or severance checks yet.
- No SRC (ՊԵԿ) integration; manual "registered" flag only.
- No native mobile app. Telegram is the mobile surface.

## Legal safety requirements
- Every rule carries `article`, `version`, `status`, `source_url` (arlis.am).
- Only `verified` rules may show red. Everything else is **advisory** with a visible disclaimer: "Սա իրավաբանական խորհրդատվություն չէ" ("This is not legal advice").
- Article numbers are never invented. All 12 seed rules are currently `needs_lawyer_review` (see `docs/RULES_MATRIX.md`).

## Languages
Armenian (`hy`, default), Russian, English. All UI, alerts and PDFs.
