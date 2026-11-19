# Glossary and style guide (hy / ru / en)

Owner: Localization dept. Armenian (hy) is the default locale. This file is the source of truth for terms in
`messages/*/*.json`, the bot, PDFs and e-mails. Automated checks: `src/i18n/messages.test.ts`.

## Core terms

| Concept | hy | ru | en | Notes |
|---|---|---|---|---|
| Product name | Տեսուչ (in running text: Տեսուչը) | Тесуч | Tesuch | One spelling per locale. Use «Տեսուչ» in quotes only where the name could be read as the common noun "inspector". In ru, use Cyrillic «Тесуч» everywhere, not "Tesuch". |
| Firm (the accounting firm / tenant that uses Tesuch) | ֆիրմա | фирма | firm | Not «կազմակերպություն» / «организация». |
| Company (a client employer inside a firm) | ընկերություն | компания | company | A firm has many companies. |
| Employer (legal party) | գործատու | работодатель | employer | |
| Employee: UI list or count | աշխատող | сотрудник | employee / staff (counts) | |
| Employee: legal party, e.g. who initiated termination | աշխատող | работник | employee | ru uses «работник» only in a legal-party sense. |
| Inspection | ստուգում | проверка | inspection | The authority is the labour inspectorate: աշխատանքային տեսչություն / инспекция труда / labour inspection. |
| Inspection readiness (the 0–100 metric, full label) | ստուգման պատրաստվածություն | готовность к проверке | inspection readiness | Full label for headings and PDFs. |
| Score (short form) | ցուցանիշ | показатель | score | Not «միավոր» / «балл». Format: «72/100». |
| Finding / issue (one rule hit on one employee) | խնդիր | проблема (ж. р.: открыта, исправлена) | issue | Applies across UI, bot, PDFs. Not «հարց» (that word means "question") and not «замечание». |
| Open / fixed / dismissed (finding status) | բաց / շտկված / անտեսված | открыта / исправлена / проигнорирована | open / fixed / dismissed | |
| Mark as fixed (button) | Նշել որպես շտկված | Отметить как исправленное | Mark fixed | Button = imperative/infinitive; status = participle («Շտկված է» / «Исправлено»). |
| Severity: red | Խախտում | Нарушение | Violation | |
| Severity: amber | Ուշադրություն | Внимание | Attention | Not «Ռիսկ» / «Риск». |
| Severity: advisory (rule not yet verified by a lawyer) | **Նախազգուշական** | **Предупреждение** | **Advisory** | We use «Նախազգուշական» on purpose, not «Խորհրդատվական», because «խորհրդատվություն» reads as legal advice. In ru, «Предупреждение», matching docs/legal/DISCLAIMER.md. Not «Рекомендация». |
| Severity: info | Հիշեցում | Напоминание | Reminder | |
| Advisory badge (short disclaimer) | Նախազգուշական․ դեռ ստուգված չէ իրավաբանի կողմից | Предупреждение: ещё не проверено юристом | Advisory: not yet verified by a lawyer | Text taken word for word from docs/legal/DISCLAIMER.md. |
| Not legal advice | իրավաբանական խորհրդատվություն չէ | не является юридической консультацией | not legal advice | |
| Alert (single notification) | զգուշացում | уведомление | alert | ru: not «предупреждение», which is reserved for the advisory badge and for notice of dismissal. |
| Weekly digest | շաբաթական ամփոփում | недельная сводка | weekly digest | Sent on Mondays. |
| Rule | կանոն | правило | rule | |
| Article (of the Labour Code) | հոդված {n} | ст. {n} | Art. {n} | Never invent numbers. If the number is unknown, use «Հոդվածը ճշտվում է» / «Статья уточняется» / "Article pending review". |
| Labour Code | Աշխատանքային օրենսգիրք (ՀՀ աշխատանքային օրենսգիրք) | Трудовой кодекс (ТК РА) | Labour Code | British spelling "Labour" in en. |
| Employment contract | աշխատանքային պայմանագիր | трудовой договор | employment contract | ru «договор», not «контракт». |
| Fixed-term contract | որոշակի ժամկետով պայմանագիր | срочный договор | fixed-term contract | |
| Indefinite contract | անորոշ ժամկետով պայմանագիր | бессрочный договор | indefinite contract | hy: the Labour Code wording «անորոշ ժամկետով», not «անժամկետ». |
| Ground (legal basis) | հիմք | основание | ground | |
| Probation | փորձաշրջան | испытательный срок (испытание) | probation | |
| Hired by transfer | ընդունված է փոխադրմամբ | принят в порядке перевода | hired by transfer | |
| Dismissal / termination of contract | աշխատանքից ազատում / պայմանագրի լուծում | увольнение / расторжение договора | dismissal / termination | |
| Notice period (before dismissal) | ծանուցման ժամկետ | срок предупреждения | notice period | ru: «дата предупреждения», not «дата уведомления». |
| Workforce reduction | հաստիքների կրճատում | сокращение штата | workforce reduction | |
| Annual leave | տարեկան արձակուրդ | ежегодный отпуск | annual leave | |
| Maternity leave | հղիության և ծննդաբերության արձակուրդ | отпуск по беременности и родам | maternity leave | |
| State Revenue Committee | ՊԵԿ | КГД | SRC | Platform: «ՊԵԿ էլեկտրոնային հարթակ» / «электронная платформа КГД» / "SRC e-platform". |
| Tax ID | ՀՎՀՀ | ИНН | Tax ID | 8 digits. |
| Employee number | տաբելային համար | табельный номер | employee ID | |
| Import (staff from a file) | ներմուծում / ներմուծել | импорт / импортировать | import | Uploading the file itself is «վերբեռնել» / «загрузить» / "upload". |
| Column (in a file) | սյունակ | столбец | column | ru: «столбец», not «колонка». |
| Template (PDF draft or CSV sample) | ձևանմուշ | шаблон | template | A PDF draft document is «սևագիր» / «черновик» / "draft". |
| Order (HR order) | հրաման | приказ | order | |
| Notice (document to an employee) | ծանուցում | уведомление | notice | |
| Checklist (PDF) | ստուգաթերթ | чек-лист | checklist | |
| Dashboard | վահանակ | панель | dashboard | |
| Roles | սեփականատեր / հաշվապահ / դիտորդ | владелец / бухгалтер / наблюдатель | owner / accountant / viewer | |
| Quiz | վիկտորինա | викторина | quiz | |
| Streak | շարք | серия | streak | «Մաքուր շաբաթ» / «чистая неделя» / "clean week". |
| Badge | կրծքանշան | значок | badge | |
| Sign in / sign-in code | մուտք / մուտքի կոդ | вход / код для входа | sign in / sign-in code | |
| E-mail | էլ․ փոստ, էլ․ հասցե | почта, эл. почта | email | hy abbreviation uses the Armenian abbreviation dot «․». |
| Self-check (public 10-question test) | ինքնաստուգում | самопроверка | self-check | |
| Demo data | դեմո տվյալներ | демо-данные | demo data | Demo company names: «Դեմո … ՍՊԸ» / «ООО «Демо …»». |

## Armenian style rules

- Use Eastern Armenian and reformed (Abeghyan) orthography: «ու», «և» (not «եւ» in running text), «-յուն», «ություն».
- **Punctuation** (the test enforces this, so ASCII forms fail):
  - Full stop: **։** (U+0589). Never use ASCII "." or ":" at the end of a sentence.
  - Pause or colon before a value or an apposition: **՝** (U+055D), e.g. «Ժամկետ՝ {date}», «Արդյունք՝ 4/5».
  - Question mark **՞** (U+055E) goes on the stressed vowel of the questioned word, e.g. «կանցնե՞ք», «Ինչո՞ւ».
  - Emphasis or exclamation mark **՛** (U+055B), used rarely.
  - Abbreviation dot and mid-dot **․** (U+2024): «թ․», «էլ․ փոստ», «օր․». It also serves as the Armenian colon between clauses, e.g. «… 5 օր հետո․ որոշեք …».
  - Quotes: **« »**. Do not use "…" or “…”.
  - Dash for ranges: en dash «1–3»; em dash «—» between phrases.
- "In N days" is «N օր հետո». Do not write «N օրից», which means "from N days".
- Ordinals: «1-ին», «2-րդ», «47-րդ». In ICU, write `{week, selectordinal, one {#-ին} other {#-րդ}}`.
- Use singular nouns after numerals: «5 աշխատող», «3 կանոն». An Armenian ICU plural therefore usually needs only `other`.
- Hyphenate case endings after Latin names: «Telegram-ով», «PDF-ով», «ArmSoft-ից».
- Address the user politely with «դուք» and imperative «-եք»: «Ստուգեք», «Ներբեռնեք».
- Write buttons as an infinitive or imperative («Պահպանել», «Ներբեռնել»). Write statuses as a participle or with «է» («Պահպանված է»).
- Latin text is allowed only in these tokens: Telegram, Excel, CSV, PDF, Tesuch, ArmSoft, Supabase, file extensions, domains (arlis.am), URLs.

## Russian style rules

- Every count needs an ICU plural with `one / few / many / other`. Use `other` for fractions: `{n, plural, one {# правило} few {# правила} many {# правил} other {# правила}}`.
  Short forms such as «{n} сотр.» or «Найдено строк: {n}» are allowed where no inflection is needed.
- Address the user with «вы» (lowercase).
- Use the letter «ё» where it belongs: «ещё», «пройдёте», «истёк».
- Put company names in «ёлочки»: ООО «Демо Логистик».
- Write consent text without gender markers like «согласен(на)». Use «Я даю согласие…» instead.

## English style rules

- Keep it plain and short. Use sentence case for headings and buttons.
- Use British spelling: labour, recognised.
- Every count needs `{count, plural, one {…} other {…}}`.

## ICU rules (all locales)

- Every locale has the same keys, and each key has the same placeholder names. A locale may inflect a placeholder (plural in ru, plain in hy) but may not drop or rename it.
- Never delete a key. If a string becomes obsolete, ask the owning team.
- `#` inside a plural branch prints the number.
