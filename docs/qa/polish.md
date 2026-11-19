# QA report: fighter "polish"

Scope: every public and `/app` page in hy, ru, en at 360/390/768/1280/1440 px, light and dark. Local production build (`pnpm build && pnpm start -p 3304`) on the real Supabase project, with demo data loaded (5 companies, 40 employees). Throwaway users were created and deleted (0 left). No app code was changed.

Method: scripted sweep of 570 page loads (19 routes × 3 locales × 5 widths × 2 modes) checking horizontal overflow, clipped text, labels, headings, landmarks, duplicate ids, console errors and target sizes; a contrast scanner (`docs/qa/polish-tools/contrast.ts`); keyboard Tab walks on 10 pages; Lighthouse; message-file review against `docs/guide/GLOSSARY.md`; PDF rendering with `pdftoppm`. Tools are in `docs/qa/polish-tools/`.

Items already listed in `docs/ARENA.md` and `docs/guide/PROPOSED_FIXES.md` are not repeated.

## Summary
| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 2 |
| Minor | 14 |
| Clean checks (no defect found) | see the end |

## Theme-token contrast ("official" theme, `src/app/globals.css:20-37`)
All text tokens pass AA in both modes. Computed with the WCAG formula.

| Pair | Light | Dark |
|---|---|---|
| ink on bg / surface | 14.53 / 15.97 | 15.27 / 13.73 |
| muted on bg / surface / surface-2 | 6.12 / 6.72 / 5.64 | 8.09 / 7.27 / 6.50 |
| accent on bg / surface | 10.25 / 11.27 | 8.22 / 7.39 |
| accent-ink on accent (primary button) | 11.27 | 8.22 |
| ok on surface / surface-2 | 6.42 / 5.39 | 7.25 / 6.48 |
| warn (amber) on surface / surface-2 | 5.61 / 4.71 | 8.16 / 7.29 |
| danger (red) on surface / surface-2 | 6.54 / 5.49 | 5.87 / 5.24 |
| advisory on surface / surface-2 | 7.96 / 6.68 | 6.74 / 6.02 |
| **line (control border) on surface** | **1.47** | **1.39** |

Severity colours and labels are consistent between the dashboard, company page, PDFs and landing mock (red = Խախտում, amber = Ուշադրություն, advisory = Նախազգուշական, violet outline badge).

## Lighthouse (local production build, mobile emulation, default throttling)
Run with `CHROME_PATH=/opt/pw-browsers/chromium`, `--headless --no-sandbox`. The signed-in run sent the throwaway user's session cookie.

| Page | Perf | A11y | Best practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| /hy | 96 | 100 | 100 | 92 | 1.1 s | 1.1 s | 230 ms | 0.001 |
| /hy/check | 99 | 100 | 100 | 92 | 1.1 s | 1.1 s | 110 ms | 0.022 |
| /hy/login | 98 | 100 | 100 | 91 | 1.1 s | 1.1 s | 170 ms | 0 |
| /hy/app (signed in) | 91 | 100 | 100 | 54 | 0.8 s | 0.8 s | 360 ms | 0 |

Extra accessibility-only runs: /hy/terms 100, /hy/privacy 100, **/hy/themes 96**, **/ru/app/quiz 96** (both fail `color-contrast`, see P-4, P-5).

Notes on the SEO column:
- `canonical` and `hreflang` fail only because the local build has no `NEXT_PUBLIC_SITE_URL`; the tags point to `https://tesuch.vercel.app/...` (`src/components/landing/site.ts:5`). Not a defect. Re-check on the preview URL.
- `/hy/app` scores 54 because it is `noindex`, which is intended.
- `/hy/login` has no meta description (P-13).
- `/hy/app` TBT 360 ms is the only number above the 300 ms line. Landing TBT is the known QA D-4.

## Findings

### Major

**P-1 Form fields and outlined buttons have a 1.4:1 border (WCAG 1.4.11 fail)**
- Severity: Major (affects every form in the product).
- Steps: open `/hy/app`, look at "Add company" in light or dark mode. Compute `--line` against `--surface`.
- Expected: a field boundary of at least 3:1 against its surroundings, because the border is the only cue where the field is. Actual: light `--line #dad5c8` on surface `#ffffff` is 1.47:1 (on page bg `#f6f4ef` 1.33:1). Dark `#2a3854` on `#152036` is 1.39:1. The white input also sits on a near-white card (1.0:1), so on a phone in sunlight the fields are almost invisible. The same border class is used for secondary buttons ("Load demo data", "Dismiss", "Choose").
- Evidence: contrast table above; `docs/qa/shots/polish/dash-ru-360-dark.png` and `settings-en-360.png`.
- Fix: add a `--control` token to each theme (official: `light-dark(#7d7868, #6b7d9f)`, which gives 4.4:1 / 3.9:1 on surface and ≥ 4.0 / 4.3 on bg) and use it for inputs and outlined buttons only. Change `border-line` to `border-control` in `src/components/dashboard/action-form.tsx:7,10`, `src/components/members/forms.tsx:10,12`, `src/components/dashboard/finding-actions.tsx:10`, `src/components/import/import-wizard.tsx:26`. Keep `--line` for card dividers. Add the token to `tokens.test.ts` so the drift test covers it.

**P-2 "Load demo data" takes 15–25 s and gives no progress feedback**
- Severity: Major (first-run experience; the demo is the main way a prospect sees the product).
- Steps: sign in with a new user, create a firm, click "Load demo data" (en), watch for 25 s (`docs/qa/polish-tools/demo.ts`).
- Expected: a visible "Loading demo data…" status and a result message. Actual: the button text becomes "…" (name `...`, no `aria-live` status) and the page looks empty ("0 employees · No issues", "No companies yet…") for 15–25 s, then jumps to 5 companies. Timings: 0.5 s, 3 s, 6 s, 10 s, 15 s all empty; at 25 s done. Users will click again or leave. If the Vercel Hobby function limit is hit the action fails with no message. The server action has no `maxDuration` (only the nightly job sets one, `src/app/api/jobs/nightly/route.ts:13`). The timing was measured through the sandbox proxy to Supabase EU, so production may be faster, but the missing feedback is real either way.
- Evidence: `docs/qa/shots/polish/demo-loading-10s.png`.
- Fix: in the demo button component (lane A, `src/components/dashboard/*`) show `{t("loadingDemo")}` text plus a `role="status"` line while pending; add `export const maxDuration = 60` to the route segment that owns the action; batch the inserts (one `insert` per table, not per employee) to cut the time.

### Minor

**P-3 App nav hides Team / Audit / Settings on phones with no scroll cue**
- Steps: `/hy/app` at 390 px (also 360 in all locales; 768 in hy: "Կարգավորումներ" is cut).
- Expected: all seven tabs reachable and visible as scrollable. Actual: `nav.overflow-x-auto` (`src/app/[locale]/app/app-nav.tsx:21`) shows five tabs; the rest sit right of x=466/522/612/764 with no fade, arrow or scrollbar. Settings is the tab with the firm and Telegram setup.
- Evidence: `app-header-hy-390.png`, `settings-en-360.png`, `import-hy-768.png`.
- Fix: add a right-edge fade (`[mask-image:linear-gradient(to_right,#000_90%,transparent)]`) and `scroll-snap`, or wrap to two rows below `md`; also scroll the active tab into view on load.

**P-4 Locked quiz badges fail contrast (2.2:1 and 3.2:1)**
- Steps: `/en/app/quiz`, locked badges. Lighthouse a11y on `/ru/app/quiz` is 96 (8 failing nodes).
- Actual: the badge box uses `opacity-50` (`src/components/quiz/streak-panel.tsx:34`), so title text is 3.20:1 (light) / 4.44:1 (dark) and the description 2.24:1 / 2.85:1. These are informational text, not disabled controls.
- Fix: drop `opacity-50`; mark locked state with `border-dashed`, grey icon (`grayscale`) and a visible "Locked / Закрыто / Փակ է" word.

**P-5 /themes "Option N" label 3.59:1**
- Steps: `/hy/themes`. Lighthouse a11y 96, `color-contrast` (2 nodes). `src/components/theme-preview.tsx:41` uses `text-xs ... text-highlight`; for the "fintech"/warm previews the highlight token is too light on the card. Fix: use `text-muted` or darken `--highlight` where it is used for small text.

**P-6 Small click targets (WCAG 2.5.8 needs 24 px)**
- "Sign out" button is 44×20 px on every app page (`src/app/[locale]/app/layout.tsx:33`). Public footer links are 20 px high on landing, check, privacy, terms and DPA (`src/components/landing/site-footer.tsx:27`). The "← back" link on company and employee pages is 20 px high. Fix: `py-2` (or `min-h-6`) on these.

**P-7 No skip link; many tab stops before content**
- Steps: press Tab on `/hy/app`. First stops: 3 mode buttons, 3 language links, Sign out, then 7 nav links before the page heading. On the landing page 5 header links come first. Fix: add a visually-hidden "Skip to content" link as the first child of `<body>` in both layouts (new key `common.skipToContent`, three locales) and `id="main"` on `<main>`.

**P-8 Armenian is set in UPPERCASE with letter-spacing**
- `src/app/[locale]/check/page.tsx:29` and `src/app/[locale]/page.tsx:38` (eyebrow: «ԱՆՎՃԱՐ ԻՆՔՆԱՍՏՈՒԳՈՒՄ», tracking 0.14em), `src/app/[locale]/app/audit/page.tsx:92` (table header «ԳՈՐԾՈՂՈՒԹՅՈՒՆ», «ՈՎ»), `src/app/[locale]/not-found.tsx` code label. Armenian capitals are not used for running labels, letter-spacing breaks the ligature-like rhythm of the script, and "Ո՞վ" loses its ՞ mark in caps. Fix: apply `uppercase`/`tracking-*` only when `locale !== "hy"` (e.g. a `hy:` variant or `[lang=hy]:normal-case [lang=hy]:tracking-normal`).
- Evidence: `check-hy-390.png`, `audit-hy-1280-dark.png`.

**P-9 Decorative glyphs are read by screen readers**
- "⬇ " is part of the text of download buttons (`src/components/documents/contract-docs.tsx:31-45`, `src/components/import/import-wizard.tsx:184`), so a screen reader says "downwards black arrow" before every label. Emoji icons in `src/components/quiz/streak-panel.tsx:4,18` ("🔥 0 недель") are read as "fire". Fix: wrap in `<span aria-hidden>`.

**P-10 Hero mock truncates Armenian and Russian rule titles**
- Steps: `/hy` at 1280 px: «Որոշակի ժամկետով պայմանագիրն ավա…». At 360 px every locale cuts all three titles («Испытательный срок больше 3 ме…»). `src/components/landing/hero-mock.tsx:69` uses `truncate`. It is a product demo on the page that sells the product, and the cut word is the point of the rule. Also the stat «0 գուշակություն» in the strip below wraps the number onto its own line at 1280 (`page.tsx:101-106`), so the four columns are uneven.
- Fix: `line-clamp-2` instead of `truncate`; give the stat value `whitespace-nowrap` and let only the label wrap.
- Evidence: `landing-trunc-hy-1280.png`, `landing-trunc-hy-360.png`, `landing-trunc-ru-360.png`.

**P-11 Footer prints the Latin name in hy and ru**
- `src/components/landing/site-footer.tsx:20`: "© 2026 Tesuch · Ստեղծված է Հայաստանի համար" (see `check-hy-390.png`). The glossary requires «Տեսուչ» / «Тесуч». Fix: use `t("common.appName")`.

**P-12 Login: no way to correct the e-mail after the code step**
- Steps: `/hy/login`, send code, notice the form shows only the code field and "Ուղարկել նոր կոդ". A typo in the address means reloading the page. Fix: add a "Use another e-mail / Изменить адрес / Փոխել հասցեն" link that returns to step 1. Evidence: `login-badcode-hy-390.png`. (The rest of the flow is good: focus moves to the code field, errors are in a `role=alert`, `autocomplete=one-time-code`, `inputmode=numeric`.)

**P-13 /login has no meta description** (Lighthouse SEO 91 vs 92). Add `description` to the page metadata and `auth.json` in the three locales.

**P-14 Checklist PDF typography (hy)**
- Labels use ASCII colons: «Ամսաթիվ:», «Պատրաստվածության միավոր:» (`src/lib/pdf/documents.ts:264-266`); the style guide asks for «՝» (the same file already uses it at line 80: «Ամսաթիվ՝»). The «Հիմք» column breaks as «…հոդված 95 (ենթակա / է իրավաբանի / ստուգման)», leaving «է իրավաբանի» on lines of 2-3 words, and the footer wraps so «1/1» sits alone on a second line. Fix: use `${label}՝` for hy; widen the basis column (or use 8 pt) and shorten the footer string for hy.
- Evidence: `pdf-checklist-hy.png`, `pdf-checklist-ru.png`. Fonts are embedded and subset correctly (Noto Sans Armenian + Noto Sans, `pdffonts`), no tofu.

**P-15 Three names for the quiz, and ru "нарушения" for findings**
- hy: nav «Վիկտորինա», page title «Շաբաթական անակնկալ ստուգում», audit table label «Թեստ» (`audit.tables.quiz_attempts`). ru: «Викторина» / «Еженедельная внезапная проверка» / «Тест». The glossary term is «վիկտորինա / викторина». «Внезапная проверка» can be read as a surprise state inspection, which is the thing the product warns about. Fix: title «Еженедельная викторина» / «Շաբաթական վիկտորինա»; audit «Վիկտորինա» / «Викторина».
- ru uses «нарушения» for findings in `audit.tables.findings`, `members.data.deleteBody`, `members.data.orgExportHint`, and `quiz.streakRule` (hy «խախտումներ»). In the glossary «Нарушение / Խախտում» is only the red severity; a finding is «проблема / խնդիր».

**P-16 Hy "you" capitalisation and "firm" vs "company" in members.json**
- The glossary says «դուք» in lower case, but `members.json` writes «Ձեր», «Ձեզ», «Դուք» with a capital in `invite.hint`, `accept.mismatch`, `accept.errors.expired`, `email.subject`, `email.body`; `errors.boundary.body` too. The same file uses «ընկերություն» for the firm (`noOrg`, `errors.forbidden`, `errors.lastOwner`, `data.orgExport`), where ru correctly says «фирма» and the glossary requires «ֆիրմա». Also `auth.notConfigured` shows the vendor name "Supabase" to the user.

## Language-fix table (new items; known ones are in PROPOSED_FIXES.md)
| Key | Locale | Current | Proposed |
|---|---|---|---|
| `audit.audit.actor` | hy | Ով | Ո՞վ (or «Կատարող») |
| `quiz.quiz.title` | hy | Շաբաթական անակնկալ ստուգում | Շաբաթական վիկտորինա |
| `quiz.quiz.title` | ru | Еженедельная внезапная проверка | Еженедельная викторина |
| `audit.audit.tables.quiz_attempts` | hy | Թեստ | Վիկտորինա |
| `audit.audit.tables.quiz_attempts` | ru | Тест | Викторина |
| `audit.audit.tables.findings` | ru | Нарушения | Проблемы |
| `members.members.data.deleteBody` | ru | …договоры, отпуска и нарушения сотрудника… | …договоры, отпуска и проблемы сотрудника… |
| `members.members.data.orgExportHint` | ru | …отпуска, нарушения и участники | …отпуска, проблемы и участники |
| `quiz.quiz.streakRule` | ru / hy | …просроченных открытых нарушений / …ժամկետանց բաց խախտումներ | …просроченных открытых проблем / …ժամկետանց բաց խնդիրներ |
| `members.members.invite.hint` | hy | Հրավերի հղումը գործում է 7 օր և միայն Ձեր նշած էլ․ հասցեի համար։ | …միայն ձեր նշած էլ․ հասցեի համար։ |
| `members.members.accept.mismatch` | hy | …իսկ Դուք մուտք եք գործել որպես {current}։ | …իսկ դուք մուտք եք գործել որպես {current}։ |
| `members.members.accept.errors.expired` | hy | …կրկին հրավիրել Ձեզ։ | …կրկին հրավիրել ձեզ։ |
| `members.members.email.subject` / `body` | hy | {inviter}-ը Ձեզ հրավիրել է… | {inviter}-ը ձեզ հրավիրել է… |
| `errors.errors.boundary.body` | hy | Ձեր տվյալները չեն կորել։ | ձեր տվյալները չեն կորել։ (lower case after «։») |
| `members.members.noOrg` | hy | Նախ ստեղծեք ընկերություն Կարգավորումներում։ | Նախ ստեղծեք ֆիրմա Կարգավորումներում։ |
| `members.members.errors.forbidden` | hy | …այս ընկերության սեփականատերերը։ | …այս ֆիրմայի սեփականատերերը։ |
| `members.members.errors.lastOwner` | hy | Ընկերությունը պետք է ունենա… | Ֆիրման պետք է ունենա… |
| `members.members.data.orgExport` | hy | Արտահանել ամբողջ ընկերությունը | Արտահանել ամբողջ ֆիրմայի տվյալները |
| `auth.auth.notConfigured` | hy/ru/en | …(Supabase-ը կարգավորված չէ) | drop the vendor name: «Մուտքը դեռ միացված չէ։» / «Вход пока не подключён.» / "Sign-in is not set up yet." |
| `legal.*`, `privacy.*`, `members.members.email.*`, `members.members.data.intro` | ru | Tesuch (e.g. «Условия использования — Tesuch (черновик)», «…пригласить в Tesuch») | Тесуч / «Тесуч» (glossary: Cyrillic everywhere in ru). 12 keys: `legal.banner.body`, `legal.terms.meta.title/description/intro`, `legal.dpa.meta.title/description/howTo`, `members.email.subject/body`, `members.data.intro`, `privacy.meta.title/description/intro` |
| `landing.footer` (code) | hy / ru | © 2026 Tesuch · … | © 2026 Տեսուչ · … / © 2026 Тесуч · … (use `common.appName`) |
| PDF labels `documents.ts:264-266` | hy | `Ամսաթիվ:` / `Պատրաստվածության միավոր:` | `Ամսաթիվ՝` / `Ստուգման պատրաստվածություն՝` |

## Checked and found clean
- 570 page loads: no horizontal page overflow at any width, every page has exactly one `h1` and one `main`, `<html lang>` always equals the locale, no duplicate ids, no heading-level skips, no unlabelled form fields, no images without `alt`. (My "unlabelled button" hits on `/app/settings` and the company page were false positives: the buttons live inside a closed `<details>`.)
- Console: only the expected 404 resource error on 404 pages. Two `React error #418` (hydration) appeared once each during the sweep (`/en/app/members/data` 1440 light and `/ru/app/companies/:id` 768 dark); 36 repeat loads of six routes could not reproduce it, so not scored. Worth a look for date/locale formatting differences between server and client if it appears again.
- Armenian glyphs: Noto Sans Armenian is loaded; no tofu on any page or in PDFs. Cyrillic falls back correctly to Noto Sans.
- Armenian punctuation: no ASCII sentence-final "." or ":", no old orthography «եւ», no "…" quotes in hy message files; ru: `ё` used, no gender markers, ICU plurals present.
- Focus: every Tab stop on 10 pages shows a visible ring (2 px outline). Documents page "inputs without ring" were hidden server-action inputs.
- Forms by keyboard: login (Enter sends, focus jumps to code, errors announced via `role=alert`), check flow, add-company, import steps, quiz radios. The members dialogs use `<dialog>`.
- 404 pages (`/hy/nope-404` etc.) are localized, have an `h1` and `noindex`; the error boundary shows a digest only.
- Severity colours and labels are consistent across UI, PDF and landing.

## Screenshots (`docs/qa/shots/polish/`, 1x PNG)
`app-header-hy-390`, `audit-hy-1280-dark`, `check-hy-390`, `company-hy-390`, `dash-ru-360-dark`, `demo-loading-3s`, `demo-loading-10s`, `documents-hy-focus`, `e404-hy-390`, `employee-ru-1280`, `import-hy-768`, `landing-trunc-hy-1280`, `landing-trunc-hy-360`, `landing-trunc-ru-360`, `login-badcode-hy-390`, `login-hy-390-dark`, `members-en-1280`, `pdf-checklist-hy`, `pdf-checklist-ru`, `quiz-ru-1280`, `settings-en-360`, `themes-ru-768`.
