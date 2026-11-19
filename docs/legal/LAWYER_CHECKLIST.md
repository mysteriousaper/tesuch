# Lawyer checklist

> ⚠️ **Everything legal in Tesuch is a DRAFT** until a lawyer licensed in the Republic of Armenia answers the questions below and signs off. No article numbers are cited anywhere on purpose: the lawyer adds them. Answers go next to each question (date, name of the reviewing lawyer, reference to the source).

Texts to review:
- Public pages (hy/ru/en): `/[locale]/privacy`, `/[locale]/terms`, `/[locale]/terms/dpa`. Sources: `messages/<locale>/privacy.json`, `messages/<locale>/legal.json`, `src/components/legal/dpa-content.ts`.
- Drafts: `CONSENT_DRAFT.md` (sign-up consent, employee notice), `DPA_DRAFT.md`, `DISCLAIMER.md`.
- Rules catalogue: `docs/RULES_MATRIX.md` (every rule is `needs_lawyer_review`).

Priority: **P0** blocks launch with real customer data; **P1** needed before paid customers; **P2** can follow.

## P0: blocks processing of real employee data

1. **Roles.** Under the Law of the Republic of Armenia on Personal Data Protection, is Tesuch a "processor" (authorised person acting for the data controller) for employee data, and the customer the controller? For account data, is Tesuch the controller? Give the exact terms the law uses so all three languages match it.
2. **Legal basis for employee data.** Is the employer's obligation under the Labour Code a sufficient basis, or is each employee's consent required? If consent is required, in what form (written, electronic)?
3. **Accounting firms.** When an accounting firm uploads data of its client companies' employees, who is the controller (the client company, the firm, both)? Does the DPA need a three-party structure or a sub-processing clause?
4. **Notification to the Personal Data Protection Agency.** Must processing be notified to the Agency, by whom (customer, Tesuch, both) and before which date? Is there a form, a fee, a register?
5. **Cross-border transfer.** Data is stored by Supabase in Ireland (EU); the app is served by Vercel, email via Resend, alerts via Telegram. Is this a cross-border transfer requiring extra steps (adequacy, permission from the Agency, contractual clauses, employee consent)? Does the answer differ for Telegram (servers outside the EU)?
6. **Date of birth.** Is storing the full date of birth (used only to detect under-18 employees) proportionate, or must we store only an "under 18 until <date>" flag?
7. **Termination ground.** Is the termination ground (free text from the employer) sensitive data in any case? Should we restrict it to a list of codes?
8. **Sign-up consent.** Is the consent gate (checkbox, not pre-ticked, recorded with the document version and server time in `consent_records`) valid consent for account data? Must it be separate per purpose (account, notifications)?
9. **Employee notice.** Approve the employee notice template in `CONSENT_DRAFT.md` section B: content, who gives it, whether a signature is needed.
10. **Not legal advice.** Approve the disclaimer wording (`DISCLAIMER.md`) and whether "Advisory" findings may be shown at all before rules are verified.

## P0: consent records (implemented, needs confirmation)

11. **What to keep as proof.** We store user id, document (`terms`, `privacy`, `dpa`), version, server timestamp and optionally a keyed hash of the IP address (only when `CONSENT_IP_SALT` is configured). Is this enough evidence? Is the IP hash necessary or should it be dropped (data minimisation)?
12. **Retention of consent records after account deletion.** Today they are deleted with the account (cascade). Must they be kept for a period after deletion to prove past consent? If so, how long, and in what form?
13. **Re-consent.** When we change the texts, we bump the version and ask every user again at next sign-in. Which changes require new consent, and which only a notice?

## P1: DPA (`/terms/dpa`)

14. Approve the 12 clauses and the role names in Armenian and English. Which language prevails on a discrepancy?
15. Fill the placeholders: response time for data subject requests [N working days], breach notification [N hours], deletion after termination [30 days], backup expiry [N days].
16. Is there a statutory deadline for notifying the Agency and/or data subjects of a breach? Who notifies whom?
17. Subprocessor changes: is "inform before adding" enough, or does the customer need a right to object or terminate?
18. Audit clause: is "once a year or after a breach, reasonable information" acceptable?
19. Signature: is an electronic acceptance (click) enough, or must the DPA be signed (wet or qualified electronic signature)? Is a Russian translation needed?

## P1: Terms of Service (`/terms`)

20. Legal entity, registration number, address and contact email for all texts (placeholders today).
21. Limitation of liability: draft the clause; what is enforceable under Armenian law for B2B services, especially for fines from inspections?
22. Competent court / arbitration and language of proceedings.
23. Pilot / fees clause: wording while the service is free.
24. Suspension and termination: notice periods; data export window before deletion.
25. Is acceptance on behalf of an organisation by any signed-in user valid, or only by the owner / an authorised representative?

## P1: Privacy notice (`/privacy`)

26. Retention periods: account data [30 days after closing], audit log [N months], free-check leads [12 months], backups [N days]. Are there statutory minimum or maximum periods (e.g. labour records)?
27. Data subject rights: is the list (access, correction, deletion, export, withdrawal) complete and correctly named? Statutory response time?
28. Name and contact of the supervisory authority as it should appear.
29. Cookies: only necessary cookies (session, selected organisation, light/dark mode). Is a cookie banner or consent required?
30. Free check (`/check`): the lead form already asks for consent. Is its wording sufficient, and what retention applies?

## P2: product rules and later

31. Verify each rule in `docs/RULES_MATRIX.md`: article number, current wording on arlis.am, thresholds, and which can become `verified` (red).
32. Telegram messages: may they contain an employee's name, or only counts and company names?
33. Generated documents (orders, notices): approve each template's wording before it is offered for download.
34. Do we need a Data Protection Officer or internal policy documents (records of processing, security policy) under Armenian law?
35. Minors: any extra rules for processing data of employees under 18 beyond the Labour Code checks?
