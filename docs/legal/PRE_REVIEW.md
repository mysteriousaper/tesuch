# Legal pre-review for the lawyer

> **Not legal advice.** Prepared by an AI assistant (not a lawyer) as a reading aid so the lawyer starts from article numbers and quotes instead of a blank page. Every conclusion below is a *hypothesis to confirm*. Nothing here changes `rules/*.json`, code or UI; the lead decides what to adopt.

Date: 22 Nov 2026. Sources: `docs/legal/sources/*.txt` (pdftotext of the owner's arlis.am PDFs), rules in `rules/*.json`, `rules/holidays/AM.json`, `docs/RULES_MATRIX.md`, `docs/legal/LAWYER_CHECKLIST.md`, `docs/RISKS.md` (R1, R5, R6).

## 0. Read this first: the provided texts are old redactions

The header of each file states which version is "in force" in the arlis.am snapshot:

| Act | Version in the file | Gap to today (22 Nov 2026) |
|---|---|---|
| Labour Code ՀՕ-124-Ն | `Գործում է (23.12.2022-06.04.2023)` | about 3.5 years of possible amendments missing |
| Personal Data law ՀՕ-49-Ն | `Գործում է (01.07.2015-11.07.2016)` | the original 2015 text, 10 years old |
| Inspections law ՀՕ-60 | `Գործում է (01.01.2012-21.07.2012)` | the 2012 text, 14 years old |

**Consequence:** a MATCH below means "matches the 2022/23 Code". Thresholds may have changed since. In particular, the Code text contains **no mention of the SRC e-platform**, which the brief says is a recent requirement, so newer amendments clearly exist. **P0 request to the owner/lawyer: download the *current* redactions** (arlis.am, field "Գործում է" with a date range that includes today). The extracted `.txt` is complete and readable (no garbling found in the passages I used; the PDF stays authoritative).

Other general notes:
- Article numbers below were read from headings in the text. I did not rely on the law-firm summary or memory for any article number. Where I could not find a provision I say **NOT FOUND**.
- Calendar vs working days: Art. 29(7) says periods counted in days are calendar days unless the labour law says otherwise, and a period ending on a non-working day moves to the next working day. This matters for the notice-period rule (14/35/42/49/60 days are calendar days).
- Verdict key: **MATCH** = article, logic and numbers agree; **PARTLY** = article exists but our logic is narrower/wider or misses a condition; **MISMATCH** = a number or the logic contradicts the text; **NOT FOUND** = no provision found in the supplied text.

## 1. Rule-by-rule

Totals: **MATCH 6 · PARTLY 5 · MISMATCH 1 · NOT FOUND 1** (13 rules). *Round 2 correction: `fixed-term-expired` was first marked NOT FOUND; the official checklist (item 18) cites Art. 111(2),(3),(5), and Art. 111(5) answers the question, so it is now MATCH.*

| # | Rule | Verdict | Article(s) found |
|---|---|---|---|
| 1 | `annual-leave-min` | PARTLY | 159(1), 164, 167(3) |
| 2 | `fixed-term-ending` | PARTLY | 95, 109(1)(2) |
| 3 | `fixed-term-expired` | MATCH | 111(5), 111(2) |
| 4 | `fixed-term-ground` | PARTLY | 95(1), 95(3) |
| 5 | `leave-cash-swap` | MATCH | 170(1) |
| 6 | `maternity-min` | MATCH | 172(1) |
| 7 | `notice-period` | PARTLY | 115(1), 113(1), 116 |
| 8 | `probation-ending` | MATCH | 93(1) |
| 9 | `probation-max` | **MISMATCH** | 92(1)–(3) |
| 10 | `probation-minor` | MATCH | 91(3)(1) |
| 11 | `probation-transfer` | MATCH | 91(3)(3) |
| 12 | `src-registration` | NOT FOUND | none (see related) |
| 13 | `termination-ground` | PARTLY | 109, 113, 115(3) |

### 1.1 `annual-leave-min` — PARTLY
- **Art. 159(1):** «Ամենամյա նվազագույն արձակուրդի տևողությունը հնգօրյա աշխատանքային շաբաթվա դեպքում 20 աշխատանքային օր է, իսկ վեցօրյա աշխատանքային շաբաթվա դեպքում` 24 աշխատանքային օր»: **thresholds 20/24 MATCH.**
- Logic gaps:
  - Art. 164(1): leave is granted per *working year* counted from the hire date (not the calendar year); first-year leave "as a rule" after six months (164(2)).
  - Art. 167(3): a postponed leave may be granted «ոչ ուշ, քան 18 ամսվա ընթացքում` սկսած այն աշխատանքային տարվա վերջից»; unused part may be carried to the next year with the employee's consent. So "less than 20 days in the last working year" can be lawful, and the rule would give a false amber. Edge case "carry-over not modelled" is real.
  - Art. 159(2): part-time does not shorten leave. Art. 160/161: extended (25/30 days, up to 35/42) and additional leave exist for listed categories; our rule only checks the floor, which is safe.
  - Art. 163: when split, one part must be ≥10 working days (five-day week) / 12 (six-day week).
- **Change:** cite Art. 159(1); treat the shortfall as a *warning only after* the 18-month window of Art. 167(3) has passed (or the employee has no postponement recorded); keep "advisory".

### 1.2 `fixed-term-ending` — PARTLY
- Art. 95 is the right article for fixed-term contracts, but it contains **no 30-day (or any) reminder window or notice duty**. The 30 days is correctly flagged as a product choice.
- **Art. 111(2):** the employer who ends the contract on expiry must give «առնվազն տասն օր առաջ» written notice (not for replacement workers or contracts for specific works, 111(3)). So the real employer deadline is **10 days**, not 30; 30 stays a product choice.
- Art. 109(1)(2): «Աշխատանքային պայմանագիրը լուծվում է` ... պայմանագրի գործողության ժամկետը լրանալու դեպքում» and 109(2) says the termination is formalised by the employer's individual legal act. That is the real trigger behind the reminder.
- **Change:** cite Art. 109(1)(2) and 109(2) (formalise the expiry) plus 95(2.1) (extension warning, see 2.12) instead of implying Art. 95 requires a notice.

### 1.3 `fixed-term-expired` — MATCH (corrected in round 2)
- **Art. 111(5):** «Եթե որոշակի ժամկետով կնքված աշխատանքային պայմանագրի գործողության ժամկետը լրանալուց հետո պայմանագիրը չի լուծվում սույն հոդվածով սահմանված կարգով, և աշխատանքային հարաբերությունները շարունակվում են, ապա պայմանագիրը համարվում է կնքված անորոշ ժամկետով»: continued work after the end date without termination turns the contract into an **indefinite** one. This is exactly the consequence the rule was waiting for. (My first pass searched only for the phrase «շարունակում է աշխատել» and missed it.)
- Related: Art. 111(2) (employer's 10-day written notice to end on expiry), 111(4) (employee's 10 days), 95(2.1) (extension or re-hire within a month → indefinite), 102 (work without a proper written contract).
- **Change:** cite Art. 111(5); the finding text can say "the contract is now considered indefinite unless it was terminated under Art. 111". Successor-contract exclusion is consistent with 95(2.1).
- The rule's severity can stay amber/advisory until the lawyer confirms; the legal basis is no longer missing.

### 1.4 `fixed-term-ground` — PARTLY
- **Art. 95(1):** «Որոշակի ժամկետով աշխատանքային պայմանագիր է կնքվում, եթե աշխատանքային հարաբերությունները չեն կարող որոշվել անորոշ ժամկետով` հաշվի առնելով կատարվելիք աշխատանքի բնույթը կամ կատարման պայմանները, եթե սույն օրենսգրքով կամ օրենքներով այլ բան նախատեսված չէ»; Art. 94: otherwise indefinite. Art. 95(3) lists permitted categories (elected posts, seasonal, temporary up to two months, replacing an absent employee, foreigners on residence permit, pension-age persons, etc.).
- The Code **does not say the ground must be written in the contract**; Art. 84(1)(9) only requires «գործողության ժամկետը (անհրաժեշտության դեպքում)». So "no stated ground" is a Tesuch data-quality check, not a statutory breach as such. A fixed-term contract without a qualifying ground is unlawful (it is deemed indefinite by Art. 94), so the useful check is "no 95(1)/95(3) category recorded".
- **Change:** reword to "fixed-term contract with no recorded Art. 95 ground" (advisory); never red until the lawyer confirms that a missing recorded ground makes the term void/indefinite. Add a ground list aligned to 95(3) items.

### 1.5 `leave-cash-swap` — MATCH
- **Art. 170(1):** «Ամենամյա արձակուրդի փոխարինումը դրամական հատուցմամբ չի թույլատրվում: Եթե աշխատանքային պայմանագրի լուծման հետևանքով ամենամյա արձակուրդի իրավունք ձեռք բերած աշխատողին չի կարող տրամադրվել ամենամյա արձակուրդ, կամ աշխատողը չի ցանկանում դրա տրամադրումը, ապա նրան վճարվում է դրամական հատուցում»: Cash is allowed only on termination; the rule excludes terminated employees: matches.
- Art. 170(1.1): for contracts under Art. 100/101 (seasonal/temporary) and for employees with under six months of service cash compensation is paid on termination: consistent with the exclusion.
- **Change:** cite Art. 170(1) and set article = "170".

### 1.6 `maternity-min` — MATCH
- **Art. 172(1):** «140 օր (70 օր` հղիության, 70 օր` ծննդաբերության) ... 155 օր ... բարդ ծննդաբերության դեպքում ... 180 օր ... միաժամանակ մեկից ավելի երեխաներ ունենալու դեպքում».
- Caveat: Art. 172(2) and (2.1) give **adoptive parents and biological parents using a surrogate** leave only «մինչև նորածնի 70 օրական ... դառնալը» (110 days for twins), i.e. shorter than 140 days by law. The rule must not fire for those cases. Art. 172(3): pay is set by other legislation (not provided).
- **Change:** set article "172(1)"; add a "adoption / surrogacy" exclusion flag or keep the rule to women on birth leave only.

### 1.7 `notice-period` — PARTLY
- **Art. 115(1):** tiers match exactly: «... մինչև մեկ տարի աշխատողին ոչ ուշ, քան 14 օր առաջ, մեկից մինչև հինգ տարի աշխատողին` 35 օր առաջ, հինգից մինչև տասը տարի աշխատողին` 42 օր առաջ, ... 49 օր առաջ, տասնհինգ տարուց ավելի աշխատողին` 60 օր առաջ». Two months for liquidation / headcount reduction (113(1)(1),(2)) also matches: «ոչ ուշ, քան երկու ամիս առաջ».
- **But the tiers apply only to specific grounds**: 113(1)(3) (unfit for the post), (7) (long incapacity), (11) (pension age) and 105(2) (essential-conditions change). Other grounds: 113(1)(12) foreigner's status → 3 days; 113(1)(13) → 3 days (115(1.1)); probation dismissal 93(1) → 3 days. **No notice period at all** is stated for fault grounds 113(1)(5),(6),(8),(9),(10). Our rule treats *every* employer termination as needing the tiers, so it would give false reds on disciplinary-type dismissals. The matrix edge case "which grounds require notice" is therefore answerable from the text.
- Further provisions not modelled: 115(2) penalty per overdue day at the average daily wage; 115(3) the notice must state ground, reason and end date; 115(5) a notice lapses if the employer does not terminate within five days after it expires; 115(4) paid time to look for work (≥10 % of working time in the notice period). Art. 114 lists situations where employer termination is **prohibited** (see 2.11).
- **Change:** make the rule ground-aware (map `termination ground → required notice`), add the 3-day cases and the 2-month case; keep fault grounds out. Needs a ground code field (see question P1-4).

### 1.8 `probation-ending` — MATCH
- **Art. 93(1):** «... կարող է մինչև փորձաշրջանի ժամկետը լրանալը աշխատողին ազատել աշխատանքից` այդ մասին երեք օր առաջ գրավոր ձևով ծանուցելով նրան» (employer-set probation). Art. 93(2): when probation was set at the employee's request, the employee may leave with 3 days' written notice.
- Notes: Art. 92(3) excludes sick leave, agreed leave, public duties, etc. from the probation term, so the *real* end date can be later than start + N months (the rule uses the recorded end date; fine if the import holds the extended date). Art. 93(3): after probation the employer can terminate only on Art. 109(1) grounds. Art. 115(2) applies the late-notice penalty to Art. 93(1).
- **Change:** none for logic; set article "93(1)".

### 1.9 `probation-max` — MISMATCH (special-case maximum)
- **Art. 92(1):** «Փորձաշրջանի ժամկետը չի կարող երեք ամսից ավելի լինել, բացառությամբ սույն հոդվածի 2-րդ մասով նախատեսված դեպքերի»: 3 months MATCH.
- **Art. 92(2):** «Հայաստանի Հանրապետության օրենսդրությամբ նախատեսված դեպքերում մինչև վեց ամիս ժամկետով կարող է սահմանվել փորձաշրջան»: **the Code's special-case maximum is 6 months, not 12.** Our rule uses `maxMonths: 12` for `probationSpecialCase`. Another act may allow 12 months for specific posts (not in the supplied sources; **NOT FOUND**), but the Code alone gives 6.
- Also Art. 92(3): absences (sick leave, agreed or unpaid leave, public duties, strikes) are not counted in the term, so "last allowed day = start + N months − 1 day" can undercount.
- **Change (for the lead):** use 6 for the special case unless the lawyer names a source for 12; add the 92(3) exclusions or note them in the finding; "start + N months − 1 day" is not stated in the Code (see Art. 29 on calculating terms: lawyer to confirm the counting rule).

### 1.10 `probation-minor` — MATCH
- **Art. 91(3)(1):** «Փորձաշրջան չի կարող նախատեսվել, եթե աշխատանքի են ընդունվում` 1) տասնութ տարին չլրացած անձինք». Age at contract start: consistent.

### 1.11 `probation-transfer` — MATCH
- **Art. 91(3)(3):** «գործատուների փոխադարձ համաձայնությամբ այլ աշխատանքի փոխադրվող անձինք». Rule matches. Other no-probation groups in the same paragraph are not covered (see 2.14): 91(3)(2) elected posts and persons who passed qualification exams or training with the employer, 91(3)(4) other cases in legislation.

### 1.12 `src-registration` — NOT FOUND
- The Labour Code text has **no reference to an SRC / e-platform registration** of contracts (grep for «հարթակ», «գրանցում» finds only collective-agreement registration and state registration of a company). Written contract form: Art. 85(1) («Գրավոր աշխատանքային պայմանագիրը կնքվում է երկու օրինակից»; electronic signature allowed).
- Possibly related (supplied Inspections law, 2012 text): Art. 3(3) mentions tax-body checks on «պարտադիր սոցիալական ապահովության վճարների (այդ թվում` վարձու աշխատողների աշխատանքային պայմանագրերի գրանցամատյանի վարման) ճշտությանն» and checks that detect employees working without a contract or contracts missing Art. 84(1) items 1, 4, 5, 6, 7. That shows an employer **register of employment contracts** and contract content were already inspection targets in 2012. The newer e-platform duty must come from later amendments or a separate act (the "SRC rules" are listed as still missing in `sources/README.md`).
- **Change:** keep as "risk flag, never a violation"; no article until the lawyer supplies it.

### 1.13 `termination-ground` — PARTLY
- Art. 113 is the list of grounds for **employer-initiated** termination only. Art. 109(1) lists all grounds (agreement, expiry, employee, employer, military call-up, court verdict, loss of right, etc.) and 109(2): termination is formalised by the employer's individual legal act. Art. 115(3)(1): the notice must state «աշխատանքից ազատելու հիմքը և պատճառը».
- Our rule fires for any terminated contract without a recorded ground, which is a reasonable data-completeness check, but the *citation* should be **Art. 109(1)** (general) with 113 for employer cases and 112 for employee-initiated (30 days' written notice, 5 days in the Art. 112(2) cases).
- **Change:** cite 109(1)/109(2); optionally require the ground to be one of the codes in 109(1)/113(1) (also helps privacy question 7 in the checklist).

## 2. Missing rules an inspector could check

All articles below are from the supplied (2022/23) Code text. "Effort" = my estimate for Tesuch (S = rule on data we already hold; M = small new field or import column; L = needs timesheets/payroll data we deliberately do not collect).

| # | Topic | Article + short quote | Effort |
|---|---|---|---|
| 2.1 | Normal working time | 139(1) «Աշխատաժամանակի նորմալ տևողությունը չի կարող անցնել շաբաթական 40 ժամից»; 139(2) 8 h/day | M (weekly hours field on contract) |
| 2.2 | Maximum working time | 139(3) «չի կարող անցնել օրական 12 ժամից ... շաբաթվա ընթացքում` 48 ժամից»; 139(5) 12 h/day across several contracts | L (timesheets) |
| 2.3 | Overtime limits | 146(1) «իրար հաջորդող երկու օրվա ընթացքում չպետք է գերազանցի 4 ժամը, իսկ տարվա ընթացքում` 180 ժամը»; 144(2) only in the exceptional cases of 145; 144(3) not for under-18s and others | L |
| 2.4 | Overtime and night pay | 184(1) overtime «ժամային դրույքաչափի 50 տոկոսից ոչ պակաս», night «ոչ պակաս, քան ... 30 տոկոսի»; 185 work on rest/holidays ≥ double or another paid day off | L (payroll) |
| 2.5 | Night work | 148(1) 22:00–06:00; 148(3) «Գիշերային աշխատանքի ներգրավել չի թույլատրվում մինչև տասնութ տարեկան անձանց»; 148(4) pregnant women and carers of children under 3 only with consent after medical review | M |
| 2.6 | Minors (extra rules) | 140(1)(4),(5) max 24 h/week (14–16), 36 h/week (16–18); 155(7) at least two days off; 89(1)(4),(5) medical certificate and (under 16) parent's written consent; 249(1) medical examination at employer's cost; 257 no heavy/harmful work | S–M (we hold birth date; need weekly hours and certificate flag) |
| 2.7 | Weekly rest | 155(5) «Ամենշաբաթյա անընդմեջ հանգիստը չպետք է պակաս լինի 35 ժամից» | L |
| 2.8 | Leave scheduling and pay | 164(1) leave in the working year; 163 one part ≥10 working days; 167(3) postponement ≤18 months; 169(2) leave pay «ոչ ուշ, քան ամենամյա արձակուրդն սկսելուց երեք օր առաջ» | S–M (we hold leave records; pay date not held) |
| 2.9 | Final settlement | 130(1) «լրիվ վերջնահաշվարկ աշխատանքային պայմանագրի լուծման օրը» (130(2): five working days if the delay is not the employer's fault); 130(3) reference letter on request | M (needs paid date) |
| 2.10 | Severance (արձակման նպաստ) | 129(1) one month's average pay for 113(1)(1),(2),(4); 113(1)(3),(7),(11), 109(1)(9) and 124 by service: 10 / 25 / 30 / 35 / 44 × average daily pay | L (salary data; matrix agrees) |
| 2.11 | Prohibited dismissals | 114(1) «արգելվում է` 1) ... ժամանակավոր անաշխատունակության ժամանակահատվածում ... 2) ... արձակուրդում ... 2.1) հղի կանանց հետ ... մինչև ... արձակուրդի ավարտման օրվանից հետո մեկ ամիսը լրանալը ... 2.2) ... մինչև մեկ տարեկան երեխա խնամելու ամբողջ ժամանակահատվածում»; 114(4) discriminatory grounds | S–M (termination date vs leave records) |
| 2.12 | Fixed-term chaining | 95(2.1) extension or second contract with a gap «չի գերազանցում մեկ ամիսը» → deemed indefinite | **S** (contract dates already held; high value) |
| 2.13 | Mass dismissal | 116(1) notify the employment authority and employee representative ≥2 months before if more than 10 % of staff and at least 10 people within two months | S (headcount + termination dates) |
| 2.14 | Other no-probation cases | 91(3)(2) elected posts; people who passed qualification exams or training at the employer | M (needs flags) |
| 2.15 | Contract content and form | 84(1) thirteen mandatory items (parties, start date, post, pay, probation, hours, leave type...); 85(1) written, two copies; 85(2) prior familiarisation with conditions and internal rules; 102 work without a written contract is unlawful. The Inspections law (3(3)) names items 1, 4, 5, 6, 7 of 84(1) as an unannounced-check trigger | S–M (checklist of fields present in the import) |
| 2.16 | Internal rules and records | 217(5) / 218 internal disciplinary rules; 132(8) employees must sign off the rules on personal-data handling; 193 payslip on request; 192(1) wages paid at least monthly «մինչև հաջորդ ամսվա 15-ը» | M (document checklist; pay date L) |
| 2.17 | Pay-reduction notice | 105(2),(3) essential-condition changes need notice per Art. 115; pay can fall without written consent only if law or collective agreement changes, with one month's written notice | M (needs contract amendment history) |
| 2.18 | Discipline procedure | 226 written explanation first; 227 «մեկ ամսվա ընթացքում» of discovery, never after six months (one year if found by audit) | L (no discipline records) |
| 2.19 | Safety, medical exams | 242–258 (OSH duties), 249(2) periodic medical exams for risk workers, 258 maternity protection | L (outside HR data; R1) |
| 2.20 | Minimum wage | 179 (set by a separate law, not provided) | L |

**Cheapest valuable additions (my pick):** 2.12 fixed-term chaining, 2.13 mass dismissal, 2.11 dismissal during leave/sick leave, 2.15 contract-content checklist, 2.6 minors (once weekly hours exist).

Paternity leave is listed in Art. 171(6) («հայրության արձակուրդը») but I did not locate its own article in the index; not assessed.

## 3. Holidays (`rules/holidays/AM.json`)

- **The Labour Code does not list holidays.** Art. 156(1): «Հայաստանի Հանրապետությունում ոչ աշխատանքային` տոնական և հիշատակի օրերը սահմանվում են օրենքով»; Art. 157 («Տոնական և հիշատակի այլ օրեր») is marked repealed by ՀՕ-117-Ն (24.06.2010). Therefore the `source_note` of `AM.json` ("as listed in the Labour Code (list of holidays and memorial days)") is **wrong** and should say the list comes from the separate holidays law (not yet provided; listed as missing in `sources/README.md`).
- I could **not verify any of the 12 dates** (Jan 1, 2, 6, 28; Mar 8; Apr 7, 24; May 1, 9, 28; Jul 5; Sep 21) from the supplied texts. Lawyer must check each against the holidays law, and specifically whether the current law has further fixed days (for example around the New Year, such as 31 December or other January days) or has dropped any. My recollection of the law is not a source and I did not use it to change the list.
- Code provisions that matter for the calendar:
  - Art. 155(1): general rest day is Sunday; with a five-day week Saturday and Sunday. Art. 155(2)–(4): businesses with continuous operation, public-service businesses and shift or summed-hours schedules set rest days differently. **`"weekend": [0, 6]` is only right for the five-day week**; six-day weeks and shift schedules need a per-organisation setting.
  - Art. 147(1): the working day before a non-working holiday is shortened by one hour (not for reduced or part-time hours).
  - Art. 156(2) work on holidays is banned except for listed cases; 185 holiday work is paid at least double or compensated by another paid day.
  - Art. 29(7): a calendar-day deadline that ends on a non-working day moves to the next working day.
  - Annual leave is counted in working days (158(1)), so holidays inside the leave period matter for leave arithmetic.
- **Not covered by the Code and absent from `AM.json`:** government decisions that move a working day to a weekend (one-off transfers). Whether such transfers are provided in the holidays law or a government decision is a question for the lawyer. `by_year` stays empty until a source is cited.

## 4. Personal Data law ՀՕ-49-Ն (2015 text) and Tesuch as processor

Terms the law uses (so the three languages can match): «անձնական տվյալներ մշակող» (processor in the sense of the controller who organises processing, Art. 3(1)(5)), **«լիազորված անձ»** (authorised person who processes on the controller's assignment, 3(1)(16)), «տվյալների սուբյեկտ», «լիազոր մարմին» (the authorised body), «երրորդ անձ» (3(1)(17): explicitly *not* the controller, subject or authorised person).

**Likely role mapping (to confirm, checklist Q1):** customer employer = «մշակող»; Tesuch for employee data = «լիազորված անձ» under Art. 14; for Tesuch's own account/lead data Tesuch is itself «մշակող».

| Topic | Article | What it says (short) | What Tesuch must do / issue |
|---|---|---|---|
| Legal basis | 8(1), 9(5) | Processing is lawful with the subject's consent unless the law directly provides otherwise | For employee data the employer relies on the Labour Code; consent only where the law requires it (checklist Q2) |
| Employer's own limits | Labour Code 132(1),(3),(8), 134(1) | Employer may process employee data only for listed purposes, obtain it from the employee, make staff sign for the data-handling rules, and not disclose to third parties without written consent unless the law provides | Lawyer: is Tesuch a "third party" under Labour Code 134(1) or an authorised person under PD law 14? (PD law 3(1)(17) says an authorised person is not a third party) |
| Assignment to Tesuch | 14(2),(3) | Written assignment stating legal bases and conditions, purpose, data list, circle of subjects, recipients, technical and organisational protection measures; processing only within the assignment; refuse if the assignment is unlawful | The DPA must contain exactly these items; compare with `DPA_DRAFT.md` and `src/components/legal/dpa-content.ts` |
| Consent form | 9(7),(8) | Written, or electronic **with a confirmed electronic digital signature**; oral only through unambiguous actions; **burden of proving consent is on the processor** | A checkbox plus `consent_records` may not equal "confirmed electronic signature" for employee consent; fine for contract-based account data? (Q8, Q11) |
| Consent notice | 10(2) | Eight items (legal basis and purpose, data list, operations, recipients, controller identity, rights, term and revocation) | Align `CONSENT_DRAFT.md` section B |
| Not collected from the subject | 18(4) | Before processing, tell the subject: controller, purpose and legal basis, data list, likely users, rights | Employee notice (Q9); employer gives it |
| Special-category data | 3(1)(14), 12(1), 23(3) | Health, trade-union membership, ethnicity, beliefs, sexual life need consent unless the law directly provides; **notify the authorised body before processing** | **Maternity leave, sick leave and a free-text termination ground (e.g. incapacity, Art. 113(1)(7)) can reveal health.** Lawyer: is storing these special-category data, and does a prior notification to the authority apply (to the employer, to Tesuch, or both)? |
| Proportionality | 5(2)–(5), 7 | Minimum data; not if the purpose can be reached with de-identified data; do not keep identifiability longer than necessary | Supports "codes by default" and the date-of-birth question (Q6); define retention |
| Minors | 9(9) | Consent for a subject under 16 (and limited legal capacity) is given by the legal representative | Employees under 16 in the data set |
| Security | 19(2),(3),(4),(9) | Use encryption means; stop unauthorised access; each user sees only what they may; the Government sets requirements for information systems; a legal entity may ask for its system to be recognised as adequately protected | Document encryption, RLS, access control; ask whether registry recognition (19(9)) is worth it |
| Breach | 21(4) | Data leak from electronic systems: «անհապաղ հրապարակել հայտարարություն», inform the **police** and the authorised body | The DPA breach clause (`[N hours]`) must reflect this; who announces: employer, Tesuch, or both (Q16) |
| Data subject rights | 15, 20, 21(1)–(3) | Access, correction, blocking, destruction; reply in **5 days** to a written request, correct within **3 working days**, reasoned written refusal in 5 days; illegal processing fixed within **3 working days** | The DPA placeholder "[N working days]" is much longer than the statutory 3–5 days; Tesuch must pass requests to the employer fast |
| Withdrawal | 9(3), 21(6) | After revocation of written consent: stop and destroy within **10 working days**, inform in 3 working days | Deletion flow and backups (Q12, Q26) |
| Notification to authority | 23(1)–(8) | Optional in general («իրավունք ունի»), **mandatory before special-category or biometric data**, and mandatory when the authority requests it; contents listed in 23(4); register entry within 30 days; changes within 10 working days | Decide whether Tesuch and/or customers notify (Q4); there is no fee for the processor (23(6)) |
| Transfer to third parties | 26 | Without consent only if provided by law and with an adequate protection level | Sub-processors are authorised persons, not third parties; confirm |
| Cross-border | 27(1)–(5) | Allowed with the subject's consent, **or** if it follows from the purposes / is necessary for them; no permission if the destination ensures adequate protection (treaty, or the authority's published list); otherwise permission of the authority, application with the contract, answer in 30 days | **EU (Supabase Ireland) and US (Vercel, Resend, Telegram)**: need the authority's list and the 27(1) argument. I cannot tell from the text whether the EU or US is on the list (R5, Q5) |
| Supervision | 24, 25 | An independent authorised body | Fill the name in the privacy notice (Q28) |

**What the supplied text does not answer:** definition of "processor/controller" is the older terminology above; the 2015 text predates later amendments. The lawyer must check the **current** act and whether newer concepts (data protection officer, impact assessment, standard clauses) exist (Q34).

## 5. Inspections law ՀՕ-60 (2012 text)

What we can say in the product (each statement must be re-checked against the current law):

- **Scope of the law:** it regulates inspections of businesses (companies, branches, sole entrepreneurs, municipalities) by state bodies; the Labour Ministry is listed among them (Art. 2(1): «Հայաստանի Հանրապետության աշխատանքի և սոցիալական հարցերի նախարարությունը»); inspections may only be based on law and within the body's powers (2(2)); interference in ongoing business is banned (2(3)).
- **Planning:** Art. 2.1 risk-based planning: businesses are put in high / medium / low risk groups (2.1(2)(3)); an annual programme is approved by 1 December of the previous year (2.1(6)) and the list of businesses and periods is published on the body's website, in force one month after adoption (2.1(7)). Inspection frequency by risk (Art. 4(3)): high ≤ once a year, medium ≤ once in 3 years, low ≤ once in 5 years. Exceptions (4(3.1)) include a follow-up to an unfulfilled order, a PM's instruction, a complaint about danger, and checks aimed at unregistered workers. **Individual risk is computed from the business's own past violations (2.1(2)(1)).**
- **Notice:** Art. 3(2),(3): an order (հրաման) or assignment naming the body, the business, the inspectors, the checklist questions, period, purpose, term and legal basis; two copies handed to the manager **at least 3 working days before** the start, against signature. **Exception:** the 3-day notice does not apply to a list of cases including Labour Ministry or tax-body checks aimed at finding workers without a contract or contracts missing Art. 84(1) items 1, 4, 5, 6, 7 (Labour Code), and checks "ըստ անհրաժեշտության" by the Labour Ministry. So a labour inspection can legally come **unannounced** in those cases.
- **Checklists:** Art. 3(1.1): most inspections run only on government-approved checklists (ստուգաթերթեր) published on the body's website; questions cover an exhaustive list of requirements whose breach may harm life, health or property rights; inspectors must answer only checklist questions (3(4)). The labour inspection checklist (N 5.1) was added in round 2: see section 7.
- **Duration:** Art. 4(1): a single inspection ≤ 15 consecutive working days per year, extendable by 10 days (up to 75 for firms above a turnover threshold), actual start = entry in the business's inspection log (ստուգման մատյան); total cap 30 working days (4(2)).
- **Rights of the business** (Art. 9): to forbid the inspection if the inspectors broke Arts. 3 and 4 (notify the body in writing the same day), to see inspection acts, to give explanations and appeal, to refuse requests outside the inspector's powers and the order, to bring lawyers or experts at any stage. **Duties** (Art. 10): do not obstruct, hand over requested documents, fix violations in the act by the stated deadline.
- **Appeal:** Art. 11(2)–(4): within **two months** to the inspector's superior body or court; superior body decides within 30 calendar days, silence means the arguments are accepted. Art. 12: compensation for unlawful acts.

**What the product may say:**
- "Inspection pack": a list of documents and data an employer should be able to show (contract in two copies, Art. 84(1) fields, internal rules, leave records, notices), clearly labelled as a preparation aid for the Art. 10(b) duty to hand over documents. Include a plain-language summary of the business's rights (Art. 9) with "check the current law" wording.
- Show checklist coverage ("Tesuch checks N areas, an inspector may check more") to answer R1.

**What the product must not claim:**
- That Tesuch **predicts or schedules** inspections: the law has a published annual programme and risk groups, but exceptions (complaints, PM orders, unregistered-worker checks, follow-ups) are unpredictable, and unannounced labour inspections exist.
- That "Ready" means compliant or safe from fines; that Tesuch's checks equal the official checklist (which we do not have); that a rule violation always leads to a fine (sanctions are in other acts, e.g. the Administrative Offences Code, not supplied).
- Specific notice periods or rights without a "text may have changed" note, because the supplied text is the 2012 redaction and the relevant bodies (e.g. the Labour Inspectorate) may have been reorganised.

## 6. Prioritised questions for the lawyer

**P0: blocks any real data or any "red" alert**
1. Please give us the *current* redactions of the Labour Code, the Personal Data law and the inspections law (our PDFs are 2022/23, 2015 and 2012). What changed since for: probation, notice periods, fixed-term contracts, contract registration (SRC), leave?
2. `probation-max`: is the special-case maximum 6 months (Code Art. 92(2)) or 12 months? If 12, which act and which posts?
3. SRC e-platform: what exactly must be registered, by whom, by when (1 Jan 2026 or 1 Jul 2027), under which act and article, and what is the sanction? May the rule ever be more than a risk flag?
4. Roles and basis: customer = controller («մշակող»), Tesuch = authorised person («լիազորված անձ», PD law Art. 14)? Does the Labour Code 134(1) "third party" disclosure rule apply to Tesuch? Is the employer's Labour Code duty enough or is employee consent needed (and in what form given Art. 9(7))?
5. Special-category data: do maternity leave, sick leave and a free-text termination ground count as health data? Is a prior notification to the authorised body (Art. 23(3)) required, by whom, and before which date?
6. Cross-border: are Ireland/EU and the US (Vercel, Resend, Telegram) on the authority's adequacy list? Else is Art. 27(1) (necessary for the purposes) enough, or is a permission under 27(3) required?

**P1: before paying customers**
7. `notice-period`: please confirm the ground-to-notice mapping we read from Art. 115 and 113 (tiers for 113(1)(3),(7),(11) and 105(2); 2 months for (1),(2); 3 days for (12),(13) and probation; none for fault grounds) and whether notice days are calendar days (Art. 29(7)).
8. `fixed-term-expired`: please confirm Art. 111(5) (continued work after expiry without termination → indefinite contract) is still in force and is the article to cite.
9. `fixed-term-ground`: must the ground be written in the contract? Is a missing/invalid ground void so the contract is indefinite?
10. `annual-leave-min`: may we flag only after the 18-month deferral window (Art. 167(3)), or is a flag per working year acceptable?
11. `maternity-min`: confirm that the adoption and surrogacy cases (Art. 172(2),(2.1)) are excluded from the 140-day floor.
12. Holidays: which law lists the days, what is the current list, are there fixed days beyond our 12, and how are weekend holidays and one-off working-day transfers handled? Does `source_note` in `AM.json` need to change (the Code does not list them)?
13. Inspections law: what is the current version, who runs labour inspections now, and is there a published labour checklist? Which wording about notice and rights may we show?
14. Breach and request deadlines: PD law Art. 21(4) (announce, police, authorised body) and Arts. 20–21 (3–5 days, 10 working days) versus our DPA placeholders: who performs each step?
15. Consent evidence: is a checkbox with server-side `consent_records` valid for account data and for employees (PD law Art. 9(7),(8))?

**P2: later**
16. Which additional rules from section 2 do you consider most often cited by inspectors (2.12, 2.13, 2.11, 2.15, 2.6)? Any sanction amounts per violation that we can show as information?
17. Retention periods for personnel records and consent records; Data Protection Officer or internal policy duties under the current law.
18. Wording check of every Armenian label for the rules above (R17).

## 7. Inspection checklists (added in round 2)

Source: `docs/legal/sources/inspection/` (28 `.txt` + originals; index in its `README.md`). All numbers below were computed from the `.docx` table of `299_1`, not estimated.

### 7.1 Which checklist covers labour law

| Checklist | File | Decision | Scope |
|---|---|---|---|
| **N 5.1 «Աշխատանքային իրավունքի բնագավառում վերահսկողություն»** | `299_1` | Annex 5 to Government decision N 718-Ն (30.04.2020), **version of decision N 299-Ն of 10.03.2022** | **Labour law** (explicitly «բացառությամբ աշխատողների առողջության պահպանման և անվտանգության ապահովման բնագավառի»), 102 scored questions plus 11 informational ones |
| N 4.3 (OSH, risk-based) | `239_1` | Decision N 239-Ն of 03.03.2022 | Workers' health and safety in construction and mining; **not HR data** |
| N 1, 2, 3 (functional assessment) | `1`, `2`, `3` | – | Disability / functional assessment procedures |
| N 1.2–1.25 | `1.4`, `1492.1-2`, `1528.1-1`, `1648.1`, `167.1`, `2026_n1371hav.1-3` | N 2001-Ն (2023), 1492-Ն (2024), 1528-Ն (2025), 1648-Ն (2025), 167-Ն (2026), 1371-Ն (2026) | Sanitary-hygiene and anti-epidemic control in schools, kindergartens, salons, dentistry, etc. |
| N 3.1–3.16 | `1528.2`, `1650.*` | N 1528-Ն (2025), 1650-Ն (17.10.2024) | Medical services / hospitals (health-care licensing control) |

**Only N 5.1 is a labour-law checklist.** It is the document the Inspections law (Art. 3(1.1)) says an inspector must follow; its basis list names the 2004 Labour Code, the foreigners law, the minimum-wage law and nine government decisions (201-Ն, 1223-Ն, 1384-Ն, 1599-Ն, 1698-Ն, 1460-Ն, 2335-Ն, 2308-Ն). **The holidays law is not in its basis list.** Each question has a weight (Կշիռ, total 50.0) and a method; all 102 questions are «Փաստաթղթային» (document check). Answers are Yes / No / Not required.

**Version warning:** N 5.1 is the March 2022 text. The later decisions in the folder amend other annexes (1, 3) of N 718-Ն, not Annex 5, so N 5.1 may still be current, but nothing in the folder proves it: ask the owner or lawyer whether a later decision amended Annex 5 or replaced N 718-Ն.

### 7.2 N 5.1: every scored question and Tesuch coverage

Legend: **Partly** = a Tesuch rule covers part of the question (rule id given). **Not covered, automatable** = could become a rule once data exists; effort S (data we hold), M (new field), L (timesheets or payroll). **Document / on-site** = an inspector checks a paper or the workplace; Tesuch can at most list it in an "inspection pack". Basis = Labour Code article numbers cited by the checklist ("+" shows other acts).

| No. | Question (short, Armenian) | Basis in checklist | Weight | Tesuch coverage |
|---|---|---|---|---|
| 1 | Յուրաքանչյուր աշխատող աշխատանքի է ընդունվել կնքված գրավոր աշխատանքային պայմանագրի… | 14 | 1 | Not covered, automatable: S: employee with no contract row |
| 2 | Աշխատանքի ընդունման մասին անհատական իրավական ակտի կամ աշխատանքային պայմանագրի մեկ… | 5, 85 | 0.3 | Document / on-site |
| 3.1 | անհատական իրավական ակտն ընդունելու, աշխատանքային պայմանագիրը կնքելու տարին, ամիսը,… | 84 | 0.3 | Not covered, automatable: S–M: missing-field check on fields we import |
| 3.2 | աշխատողի անունը, ազգանունը | 84 | 0.2 | Not covered, automatable: S–M: missing-field check on fields we import |
| 3.3 | կազմակերպության անվանումը կամ ֆիզիկական անձ գործատուի անունը, ազգանունը | 84 | 0.2 | Not covered, automatable: S–M: missing-field check on fields we import |
| 3.4 | կառուցվածքային ստորաբաժանումը (դրա առկայության դեպքում) | 84 | 0.3 | Not covered, automatable: S–M: missing-field check on fields we import |
| 3.5 | աշխատանքը սկսելու տարին, ամիսը, ամսաթիվը | 84 | 0.3 | Not covered, automatable: S–M: missing-field check on fields we import |
| 3.6 | պաշտոնի անվանումը և (կամ) աշխատանքային գործառույթները | 84 | 0.5 | Not covered, automatable: S–M: missing-field check on fields we import |
| 3.7 | հիմնական աշխատավարձի չափը և (կամ) այն որոշելու ձևը | 84 | 0.5 | Not covered, automatable: S–M: missing-field check on fields we import |
| 3.8 | աշխատողներին սահմանված կարգով տրվող հավելումները, հավելավճարները, լրավճարները | 84 | 0.5 | Not covered, automatable: S–M: missing-field check on fields we import |
| 3.9 | անհատական իրավական ակտի կամ աշխատանքային պայմանագրի գործողության ժամկետը… | 84 | 0.2 | Not covered, automatable: S–M: missing-field check on fields we import |
| 3.10 | փորձաշրջան սահմանելու դեպքում` փորձաշրջանի տևողությունը և պայմանները | 84 | 0.3 | Not covered, automatable: S–M: missing-field check on fields we import |
| 3.11 | աշխատաժամանակի ռեժիմը՝ աշխատաժամանակի նորմալ տևողություն կամ ոչ լրիվ աշխատաժամանակ… | 84 | 0.3 | Not covered, automatable: S–M: missing-field check on fields we import |
| 3.12 | ամենամյա արձակուրդի տեսակը (նվազագույն, լրացուցիչ, երկարացված) և տևողությունը | 84 | 0.3 | Not covered, automatable: S–M: missing-field check on fields we import |
| 3.13 | իրավական ակտը ստորագրող անձի պաշտոնը, անունը, ազգանունը | 84 | 0.3 | Not covered, automatable: S–M: missing-field check on fields we import |
| 3.14 | Համատեղությամբ աշխատանքի դեպքում աշխատանքային պայմանագրում նշված է, որ աշխատանքը… | 99 | 0.3 | Document / on-site |
| 4 | Պահպանվել է փորձաշրջան սահմանելու արգելքը կամ ժամկետը | 7, 91, 92 | 0.3 | Partly: probation-max, probation-minor, probation-transfer |
| 5 | Աշխատանքի անցնելուց առաջ գործատուն կամ նրա լիազորած անձը աշխատանքի ընդունվող անձին… | 85 | 0.3 | Document / on-site |
| 6.1 | անձը հաստատող փաստաթուղթ | 89 | 0.2 | Document / on-site |
| 6.2 | սոցիալական ապահովության քարտ կամ սոցիալական ապահովության քարտ չունենալու մասին… | 89 | 0.2 | Document / on-site |
| 6.3 | կրթության կամ անհրաժեշտ որակավորման մասին վկայական, եթե աշխատանքային օրենսդրությանը… | 89 | 0.2 | Document / on-site |
| 6.4 | տեղեկանք առողջական վիճակի մասին (սանիտարական գրքույկ), եթե աշխատանքային պայմանագիրը… | 89 | 0.5 | Document / on-site |
| 6.5 | ծնողներից մեկի, որդեգրողի կամ հոգաբարձուի կամ խնամակալի գրավոր համաձայնությունը, եթե… | 89 | 0.3 | Document / on-site |
| 6.6 | կացության կարգավիճակի և (կամ) աշխատանքի թույլտվության վերաբերյալ փաստաթուղթ | 89, 22 (+other laws) | 0.5 | Document / on-site |
| 7 | Աշխատանքի ընդունման հայտարարություններում (մրցույթներում) և աշխատանքային… | 3.1, 89 | 0.3 | Document / on-site |
| 8 | Գործատուն աշխատողին չի թույլատրել կատարել իր աշխատանքային պարտականությունները և չի… | 7, 108 | 0.2 | Document / on-site |
| 9 | Որոշակի ժամկետով աշխատանքային պայմանագիր կնքվել է, եթե աշխատանքային… | 7, 95 | 0.5 | Partly: fixed-term-ground |
| 10 | Մինչև 16 տարեկան անձանց հետ կնքվել է ժամանակավոր աշխատանքային պայմանագիր | 17 | 0.3 | Not covered, automatable: S |
| 11 | Նույն աշխատողի հետ նույն աշխատանքի համար որոշակի ժամկետով կնքված աշխատանքային… | 7, 95 | 0.5 | Not covered, automatable: S |
| 12 | Գործատուն աշխատանքի էական պայմանները փոփոխել է արտադրության ծավալների և (կամ)… | 105 | 0.8 | Document / on-site |
| 13 | Երեխային փաստացի խնամող՝ արձակուրդում չգտնվող անձի՝ մինչև մեկ տարեկան երեխա խնամելու… | 105 | 0.3 | Document / on-site |
| 14 | Գործատուն, առանց աշխատողի գրավոր համաձայնության, աշխատանքի վարձատրության չափը և… | 105 | 0.3 | Document / on-site |
| 15 | Աշխատանքի էական պայմանները փոփոխելիս աշխատողը տեղափոխվել է այնպիսի աշխատանքի, որն… | 105 | 0.3 | Document / on-site |
| 16 | Աշխատանքի էական պայմանների փոփոխման դեպքում գործատուն իր մոտ մինչև մեկ տարի… | 105 | 0.3 | Not covered, automatable: M |
| 17 | Կողմերի համաձայնությամբ աշխատանքային պայմանագիրը լուծելիս պահպանվել է աշխատանքային… | 110 | 0.3 | Document / on-site |
| 18 | Պահպանվել է գործողության ժամկետը լրանալու պատճառով աշխատանքային պայմանագրի լուծման… | 111 | 0.3 | Partly: fixed-term-expired, fixed-term-ending |
| 19 | Պահպանվել է աշխատողի նախաձեռնությամբ աշխատանքային պայմանագրի լուծման կարգը | 7, 112 | 0.3 | Document / on-site |
| 20 | Գործատուի նախաձեռնությամբ աշխատանքային պայմանագիրը լուծվել է գործատուի… | 7, 120-122 | 1 | Partly: termination-ground |
| 21 | ՀՀ աշխատանքային օրենսգրքի 113-րդ հոդվածի 1-ին մասի 2-րդ, 3-րդ և 4-րդ կետերով… | 113 | 0.3 | Document / on-site |
| 22 | Գործատուի նախաձեռնությամբ աշխատանքային պայմանագիրը լուծելիս պահպանվել են ծանուցման… | 115 | 0.4 | Partly: notice-period |
| 23 | Աշխատանքի էական պայմանների փոփոխման կամ աշխատանքային պայմանագրի լուծման ծանուցման… | 115, 195 | 1 | Not covered, automatable: L: needs timesheets / payroll |
| 24 | Աշխատանքային պայմանագրի լուծումը ձևակերպվել է գործատուի ընդունած անհատական իրավական… | 109, 5 | 0.3 | Document / on-site |
| 25 | Պահպանվել է գործատուի նախաձեռնությամբ աշխատանքային պայմանագիրը լուծելու, ինչպես նաև… | 105, 114 | 0.6 | Not covered, automatable: S–M |
| 26 | Պահպանվել են աշխատողների ներկայացուցչի աշխատանքից ազատման կարգը և երաշխիքները | 119 | 0.3 | Document / on-site |
| 27 | Գործատուի նախաձեռնությամբ աշխատանքի էական պայմանները փոփոխվելու, ինչպես նաեւ… | 129, 195 | 0.3 | Not covered, automatable: L: needs timesheets / payroll |
| 28 | Վերջնահաշվարկի օրը գործատուն աշխատողին վճարել է աշխատավարձը և դրան հավասարեցված այլ… | 111, 112, 130, 170, 195 | 1.1 | Not covered, automatable: M–L: needs paid date |
| 29 | Աշխատողի ցանկությամբ գործատուն տրամադրել է տեղեկանք աշխատանքային գործառույթների… | 130 | 0.1 | Document / on-site |
| 30.1 | Պահպանվել է շաբաթվա ընթացքում աշխատողների աշխատաժամանակի նորմալ տևողությունը | 139 (+gov. decisions) | 0.4 | Not covered, automatable: M: weekly hours / schedule field |
| 30.2 | Պահպանվել է աշխատողների ամենօրյա աշխատաժամանակի նորմալ տևողությունը | 139 (+gov. decisions) | 0.8 | Not covered, automatable: L: needs timesheets / payroll |
| 30.3 | Պահպանվել է աշխատաժամանակի կրճատ տևողությունը | 140 | 0.8 | Not covered, automatable: M: weekly hours / schedule field |
| 30.4 | Օրենքով նախատեսված դեպքերում սահմանվել է ոչ լրիվ աշխատաժամանակ | 141 | 0.8 | Document / on-site |
| 30.5 | Սահմանվել է յուրաքանչյուր աշխատողի աշխատաժամանակի և հանգստի ժամանակի բաշխումը… | 142 | 1 | Document / on-site |
| 30.6 | Ստույգ հաշվառվել է յուրաքանչյուր աշխատողի օրական և (կամ) շաբաթական աշխատաժամանակը | 142 | 1.3 | Document / on-site |
| 30.7 | Պահպանվել են աշխատաժամանակի գումարային հաշվարկի կիրառման կարգը և սահմանափակումները | 143, 154, 155 | 0.5 | Document / on-site |
| 30.8 | Աշխատողներն արտաժամյա աշխատանքի են ներգրավվել բացառիկ դեպքերում | 145 | 0.5 | Document / on-site |
| 30.9 | Պահպանվել են արտաժամյա աշխատանքի ներգրավվման սահմանափակումները | 144 | 0.5 | Not covered, automatable: L: needs timesheets / payroll |
| 30.10 | Պահպանվել է օրական, շաբաթական աշխատաժամանակի առավելագույն տևողությունը` ներառյալ… | 139 | 0.8 | Not covered, automatable: L: needs timesheets / payroll |
| 30.11 | Յուրաքանչյուր աշխատողի համար իրար հաջորդող երկու օրվա ընթացքում արտաժամյա աշխատանքի… | 146 | 0.8 | Not covered, automatable: L: needs timesheets / payroll |
| 30.12 | Յուրաքանչյուր աշխատողի համար գործատուի պահանջով արտաժամյա աշխատանքի տևողությունը… | 146 | 0.5 | Not covered, automatable: L: needs timesheets / payroll |
| 30.13 | Ոչ աշխատանքային` տոնական և հիշատակի օրերի նախօրյակին աշխատանքային օրվա տևողությունը… | 147 | 0.5 | Document / on-site |
| 30.14 | Պահպանվել է մինչև տասնութ տարեկան անձանց, ինչպես նաև այն աշխատողներին գիշերային… | 148 | 0.4 | Not covered, automatable: M: weekly hours / schedule field |
| 30.15 | Հղի կանայք և մինչև երեք տարեկան երեխա խնամող աշխատողները գիշերային աշխատանքի են… | 148 | 0.4 | Document / on-site |
| 31.1 | Պահպանվել են հանգստի և սնվելու համար ընդմիջման տրամադրման կարգը և պայմաններ | 152 | 0.3 | Document / on-site |
| 31.2 | Պահպանվել է տասնչորսից մինչև տասնութ տարեկան անձանց հանգստյան, ոչ աշխատանքային`… | 17 | 0.4 | Document / on-site |
| 31.3 | Մինչև տասնութ տարեկան աշխատողներին, որոնց աշխատաժամանակի տևողությունը գերազանցում է… | 153 | 0.3 | Document / on-site |
| 31.4 | Տրամադրվել են հատուկ ընդմիջումներ, երբ աշխատանքը կատարվում է պլյուս 40 աստիճան… | 153 | 0.3 | Document / on-site |
| 31.5 | Պահպանվել է աշխատանքային օրերի (հերթափոխերի) միջև ամենօրյա անընդմեջ հանգստի… | 154 | 0.6 | Not covered, automatable: L: needs timesheets / payroll |
| 31.6 | Պահպանվել է ամենշաբաթյա անընդմեջ հանգստի տևողությունը | 155 | 0.6 | Not covered, automatable: L: needs timesheets / payroll |
| 31.7 | Պահպանվել են աշխատողներին հանգստյան օրերին աշխատանքի ներգրավելու արգելքը և կարգը | 155 | 0.4 | Document / on-site |
| 31.8 | Պահպանվել է աշխատողներին ոչ աշխատանքային` տոնական և հիշատակի օրերին աշխատանքի… | 156 | 0.4 | Document / on-site |
| 31.9 | Պահպանվել են ամենամյա արձակուրդի (նվազագույն, լրացուցիչ, երկարացված, տեղափոխված,… | 7, 159, 160, 161, 168 (+gov. decisions) | 0.3 | Partly: annual-leave-min |
| 31.10 | Սահմանված կարգով աշխատողներին տրամադրվել է նպատակային արձակուրդ | 172-176.1, 195 | 0.1 | Partly: maternity-min |
| 32.1 | Աշխատողների համար սահմանվել և վճարվել է նվազագույն աշխատավարձի չափից ոչ պակաս… | 7, 179, 180, 189 (+other laws) | 1.3 | Not covered, automatable: L: needs timesheets / payroll |
| 32.2 | Պահպանվել են աշխատավարձի վճարման ժամկետները և կարգը | 7, 192 | 1.3 | Not covered, automatable: L: needs timesheets / payroll |
| 32.3 | Արտաժամյա աշխատանքի յուրաքանչյուր ժամի համար ժամային դրույքաչափից բացի աշխատողին… | 7, 84.1, 184 | 0.8 | Not covered, automatable: L: needs timesheets / payroll |
| 32.4 | Գիշերային աշխատանքի յուրաքանչյուր ժամի համար ժամային դրույքաչափից բացի աշխատողներին… | 7, 84.1, 184 | 0.8 | Not covered, automatable: L: needs timesheets / payroll |
| 32.5 | Ծանր, վնասակար, առանձնապես ծանր և առանձնապես վնասակար աշխատանքները կատարելու համար… | 7, 183 (+gov. decisions) | 0.8 | Not covered, automatable: L: needs timesheets / payroll |
| 32.6 | Հանգստյան և օրենքով սահմանված ոչ աշխատանքային` տոնական և հիշատակի օրերին աշխատանքի… | 7, 185 | 0.8 | Not covered, automatable: L: needs timesheets / payroll |
| 32.7 | Աշխատանքի ժամանակացույցով՝ օրենքով սահմանված ոչ աշխատանքային` տոնական և հիշատակի… | 7, 185 | 0.8 | Not covered, automatable: L: needs timesheets / payroll |
| 32.8 | Պահպանվել է ոչ աշխատողի մեղքով առաջացած պարապուրդի ընթացքում աշխատավարձի վճարման… | 186 | 0.8 | Document / on-site |
| 32.9 | Պահպանվել է ուսումնական (այդ թվում՝ նախադպրոցական) հաստատությունների համար… | 187.1 | 0.2 | Document / on-site |
| 32.10 | Աշխատողի աշխատանքի ծավալի ավելացման դեպքում աշխատանքը վարձատրվում է կատարված… | 7, 188 | 0.4 | Document / on-site |
| 32.11 | Ամենամյա արձակուրդի համար հաշվարկվել և աշխատողին է վճարվել միջին աշխատավարձ՝… | 7, 169, 195 | 0.8 | Not covered, automatable: M: leave pay date |
| 32.12 | Վճարված, սակայն չօգտագործված ամենամյա արձակուրդի օրերը հետագայում օգտագործելու… | 169, 195 | 0.8 | Not covered, automatable: L: needs timesheets / payroll |
| 32.13 | Գործատուի մեղքով աշխատավարձի վճարումը օրենսգրքով, կոլեկտիվ պայմանագրով կամ կողմերի… | 198 | 0.8 | Not covered, automatable: L: needs timesheets / payroll |
| 32.14 | Գործատուի կողմից սովորելու գործուղված աշխատողին ուսումնական արձակուրդի յուրաքանչյուր… | 7, 195, 200 | 0.8 | Document / on-site |
| 32.15 | Պահպանվել է աշակերտների կամ աշխատանքի ընդունվող անձի մասնագիտական ուսուցման… | 7, 201.1 | 0.3 | Document / on-site |
| 32.16 | Լրացուցիչ և հատուկ ընդմիջումների համար վճարվել է միջին աշխատավարձ | 195, 203 | 0.3 | Document / on-site |
| 32.17 | Դաշտային պայմաններում կամ տեղափոխման (տեղաշարժման) բնույթ կրող աշխատանքների համար… | 205 (+gov. decisions) | 0.3 | Document / on-site |
| 32.18 | Պահպանվել են գործուղման մեկնած աշխատողների երաշխիքները և վճարվել են հատուցումները | 7, 209 (+gov. decisions) | 0.4 | Document / on-site |
| 32.19 | Աշխատավարձից պահումները կատարվել են օրենքով նախատեսված դեպքերում | 213 | 0.8 | Document / on-site |
| 32.20 | Աշխատավարձը վճարելիս պահումների և գանձումների ընդհանուր չափը չի գերազանցել աշխատողի… | 214 | 0.3 | Not covered, automatable: L: needs timesheets / payroll |
| 32.21 | Պահումներն ու գանձումները կատարելուց հետո աշխատողին վճարվող աշխատավարձը պակաս չէ… | 214 | 0.5 | Not covered, automatable: L: needs timesheets / payroll |
| 33 | Պահպանվել է մինչև տասնութ տարեկան աշխատողի, հղի կանանց և մինչև մեկ տարեկան երեխա… | 209 | 0.3 | Document / on-site |
| 34.1 | Կարգապահական պատասխանատվության է ենթարկվել միայն աշխատանքային կարգապահությունը… | 7, 222 | 0.3 | Document / on-site |
| 34.2 | Աշխատանքային կարգապահության յուրաքանչյուր խախտման համար նշանակվել է մեկ կարգապահական… | 7, 225 | 0.3 | Document / on-site |
| 34.3 | Մինչև կարգապահական տույժի կիրառումը՝ գործատուն գրավոր կերպով աշխատողից պահանջել է… | 7, 226 | 0.4 | Document / on-site |
| 34.4 | Պահպանվել են կարգապահական տույժի կիրառման ժամկետները | 7, 227 | 0.5 | Document / on-site |
| 35 | Պահպանվել է Հայաստանի Հանրապետության օրենսդրությամբ սահմանված ծանր, վնասակար,… | 257, 5 (+gov. decisions, other laws) | 0.8 | Document / on-site |
| 36 | Պահպանվել է հղի կամ մինչև մեկ տարեկան երեխա խնամող կանանց Հայաստանի Հանրապետության… | 258 (+gov. decisions) | 0.4 | Document / on-site |
| 37 | Հղի և մինչև մեկ տարեկան երեխա խնամող կինը բժշկական հետազոտություն անցնելու համար… | 258, 195 | 0.4 | Document / on-site |
| 38 | Երեխային կրծքով կերակրող կնոջը մինչև երեխայի մեկուկես տարին լրանալը, երեխային… | 258, 195 | 0.4 | Document / on-site |

The heaviest questions are 30.6 (working-time records, 1.3), 32.1 (minimum wage, 1.3), 32.2 (pay deadlines, 1.3), 28 (final settlement, 1.1) and 1, 20, 23, 30.5 (each 1.0).

### 7.3 Coverage

| Measure | Questions | Share of 102 | Weight | Share of weight (50.0) |
|---|---|---|---|---|
| Fully covered by a Tesuch rule | 0 | 0 % | 0.0 | 0 % |
| **Partly covered** (7: Nos. 4, 9, 18, 20, 22, 31.9, 31.10) | 7 | **6.9 %** | 2.9 | 5.8 % |
| Not covered, automatable | 43 | 42.2 % | 25.3 | 50.6 % |
| Document / on-site only | 52 | 51.0 % | 21.8 | 43.6 % |

**Today Tesuch fully answers none of the 102 checklist questions and partly answers 7 (about 7 % by count, 6 % by weight).** Three of our 13 rules have no counterpart in the checklist: `fixed-term-ending` (reminder only), `leave-cash-swap` (Art. 170(1) is not cited; only 170(2) appears in No. 28), `src-registration` (not in the 2022 checklist). The 43 automatable questions need either data we hold (contracts, leave: effort S/M, 23 questions) or payroll and timesheets (effort L, 20 questions).

### 7.4 Top 15 candidates for new rules or document-checklist items

Weights are the checklist's own. "Doc item" = add to an inspection-pack checklist ("have this ready"), no data needed.

| # | Checklist No. | What | Weight | Type | Effort |
|---|---|---|---|---|---|
| 1 | 1 | Employee with no written contract or hiring act on file | 1.0 | Rule on data we hold | S |
| 2 | 20 | Employer termination without one of the Art. 113 grounds: store a ground **code** (extends `termination-ground`) | 1.0 | Rule | S–M |
| 3 | 11 | Fixed-term contract extended or re-concluded within one month (Art. 95(2.1)) → indefinite | 0.5 | New rule | S |
| 4 | 25 | Dismissal during sick leave, leave, pregnancy, child under 1 year (Art. 114) | 0.6 | New rule | S–M |
| 5 | 22 + 16 | Make `notice-period` ground-aware; add essential-conditions-change notice (Art. 105(2)) | 0.4 + 0.3 | Fix + rule | S |
| 6 | 3.1–3.13 | Contract has all 13 mandatory Art. 84(1) items (the Inspections law names items 1, 4, 5, 6, 7 as an unannounced-check trigger) | 4.2 in total | Rule (missing-field check) + doc item | S–M |
| 7 | 4 | Probation: fix the 6-month special case and the Art. 92(3) exclusions; add the other no-probation cases (91(3)(2),(4)) | 0.3 | Fix | S |
| 8 | 10 | Under-16 employee must have a temporary (fixed-term) contract (Art. 17(4)) | 0.3 | New rule (birth date + term) | S |
| 9 | 30.6 | Working-time records are kept for every employee (highest weight) | 1.3 | Doc item (rule later) | S (doc) / L (rule) |
| 10 | 30.5 | Written work and rest schedules per employee | 1.0 | Doc item | S |
| 11 | 32.1 + 32.2 | Minimum wage and pay deadlines (by the 15th, Art. 192) | 1.3 + 1.3 | Doc item now; rule needs payroll import and the minimum-wage law | S (doc) / L (rule) |
| 12 | 28 | Final settlement paid on the termination day (Art. 130) | 1.1 | Rule if a paid-date field is added | M |
| 13 | 12 | Documented business reason when essential conditions change (Art. 105(1)) | 0.8 | Doc item | S |
| 14 | 30.3 + 30.14 + 31.2 | Under-18 limits: weekly hours (24 / 36), no night work, no rest-day work, two days off | 0.8 + 0.4 + 0.4 | Rule once weekly hours / schedule exist | M |
| 15 | 6.1–6.6 | Hiring documents on file (ID, SSN, certificates, medical, parent consent under 16, foreigner's permit) | 1.9 in total | Doc item (6.4 and 6.5 matter most: 0.5, 0.3) | S |

### 7.5 Do the checklists confirm the earlier findings?

- **`probation-max`: confirmed.** Question 4 cites Art. 91(3) and **92(1),(2)** (not any 12-month provision). The checklist gives no numbers, but it points to the same two paragraphs I read: 3 months, and 6 months in cases provided by legislation. No source for 12 months appears among the checklist's 11 legal bases.
- **`notice-period`: confirmed, with the ground-aware reading.** Question 16 repeats the 14/35/42/49/60-day tiers for **essential-condition changes** (Art. 105(2) with 115(1)), and question 22 asks only whether "the notice terms and procedure" (115(1),(3),(4)) were kept; question 20 first requires that a Art. 113 ground exists (113, 120–122); question 21 requires offering other work for grounds 113(1)(2),(3),(4). Nothing contradicts my reading that the tiers apply to specific grounds; question 23 adds the late-notice penalty (115(2), 195).
- **Holidays: confirmed, and nothing new.** The checklist cites only 147(1) (shortened pre-holiday day, No. 30.13), 156(2) (no work on holidays, 31.8) and 185 (double pay, 32.6, 32.7). It lists **no holidays law** among its bases and never lists dates, so the date list must still come from the separate law.
- **Corrected:** `fixed-term-expired`. Question 18 cites Art. 111(2),(3),(5); Art. 111(5) makes the contract indefinite if work continues, so that rule now has a legal basis (see 1.3).
- **Extra points the checklist surfaces:** Art. 111(2) gives a 10-day written notice for ending a contract on expiry (our reminder window of 30 days is longer, which is fine); late wages carry a penalty of 0.15 % of the unpaid pay per overdue day (question 32.13, Art. 198); deductions are capped at 50 % of a month's pay (32.20, Art. 214); the 1-hour pre-holiday shortening is checked (30.13); the checklist cites Art. 7(7) (labour-law norms apply to the relationship) as a general basis in 23 questions.

### 7.6 Which sources look outdated

| File | Why |
|---|---|
| `labour-code-HO-124-N` | redaction valid 23.12.2022–06.04.2023; the 2022 checklist is consistent with it, but later amendments (for example the SRC registration duty) are missing |
| `personal-data-law-HO-49-N` | 2015–2016 redaction; likely replaced or amended since |
| `inspections-law-HO-60` | 2012 redaction; labour inspection powers, checklists and notice rules may have changed |
| `inspection/299_1` (checklist N 5.1) | March 2022 version; confirm it is still the current Annex 5 |
| `inspection/1`, `2`, `3` | undated copies without a decision header; cannot tell the version |
| `inspection/239_1` | 2022 (OSH, not HR) |
| `inspection/1650.*`, `1528.*`, `1648.1`, `167.1`, `2026_n1371*`, `1492.1-2`, `1.4` | 2023–2026: current, but irrelevant to labour-law readiness |

Docs only: no rule, code or UI file was changed in round 2.

> **Owner confirmation (22 Nov 2026):** the owner checked arlis.am and confirms these are the current versions in force today (no later amendments found). A lawyer should still confirm before rules are marked verified.
