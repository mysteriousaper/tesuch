# Proposed localization fixes for other teams

Owner: Localization dept. These files belong to other teams, so Localization did not edit them.
Each fix follows [GLOSSARY.md](GLOSSARY.md). Before changing a visible string, check `tests/e2e/**` for selectors that match on it.

## dashboard.json (Product / lane B)

| Key | Locale | Now | Proposed | Why |
|---|---|---|---|---|
| `dashboard.markFixed` | hy | Շտկված է | Նշել որպես շտկված | This is a button, so it needs an action verb. «Շտկված է» is a status ("is fixed"). Also update the quote in `reopenHint`. |
| `dashboard.markFixed` | ru | Исправлено | Отметить как исправленное | Same reason: button vs status. |
| `dashboard.reopenHint` | hy | «Շտկված է» նշելուց հետո… | «Նշել որպես շտկված» սեղմելուց հետո… | Keep the quote in sync with the button label. |
| `dashboard.noFindings` | ru | Открытых проблем нет. Так держать. | Открытых проблем нет. Так держать! | Punctuation. This is an interjection. |
| `dashboard.noFindings` | hy | Բաց խնդիր չկա։ Այսպես էլ պահեք։ | Բաց խնդիր չկա։ Այդպես շարունակեք։ | More natural. Also matches the bot digest wording. |
| `dashboard.employeesCount` | ru | `one / few / other` | add `many {# сотрудников}`, set `other {# сотрудника}` | Full CLDR ru plural set. `other` covers fractions. |
| `dashboard.openFindings` | hy | `=0 / other` | add `one {# բաց խնդիր}` | Optional. Keeps hy in line with the same key in `themes.json`. |
| `dashboard.fields.indefinite` | — | Անորոշ ժամկետով | (keep) | Correct. `import.json` should match it (see below). |

## import.json (Data / lane B)

| Key | Locale | Now | Proposed | Why |
|---|---|---|---|---|
| `import.indefinite` | hy | Անժամկետ | Անորոշ ժամկետով | Labour Code wording. Matches `dashboard.fields.indefinite`. |
| `import.error.endDateOnIndefinite` | hy | Անժամկետ պայմանագիրը… | Անորոշ ժամկետով պայմանագիրը… | Same term. |
| `import.fields.notice_given_on` | ru | Дата уведомления | Дата предупреждения | Legal term «срок/дата предупреждения». Matches `dashboard.fields2.noticeGivenOn`. |
| `import.error.probationBeforeStart` | ru | Испытательный срок кончается раньше приёма | Испытательный срок заканчивается раньше даты приёма | «кончается» is colloquial. |
| `import.rowsFound` / `validRows` / `imported` … | ru | «Найдено строк: {count}» | (keep) | Fine. The "label: number" pattern avoids plural forms. |

## documents.json (Documents / lane C)

| Key | Locale | Now | Proposed | Why |
|---|---|---|---|---|
| `documents.checklistHint` | hy | …բոլոր բաց հարցերը… | …բոլոր բաց խնդիրները… | Finding = «խնդիր». «հարց» means "question". |
| `documents.checklistHint` | ru | Все открытые замечания компании… | Все открытые проблемы компании… | Finding = «проблема», as in the dashboard. |
| `documents.checklistHint` | en | All open findings… | All open issues… | Finding = "issue", as in the dashboard. |
| `documents.contract` | hy | Պայմանագիր {start}–ից | Պայմանագիր {start}-ից | Use a hyphen, not an en dash, before a case ending. |
| `documents.noticeDate` | ru | Дата уведомления | Дата предупреждения | Matches dashboard and the Labour Code term. |
| `documents.draftNote` | ru | Черновые шаблоны — перед использованием проверьте у юриста. | Черновики шаблонов: перед использованием покажите их юристу. | More natural. |

## Hard-coded strings in code

| File:line | Now | Proposed | Owner |
|---|---|---|---|
| `src/lib/notify/i18n.ts:9` | hy amber «Ռիսկ» | «Ուշադրություն» | Messaging |
| `src/lib/notify/i18n.ts:10` | ru amber «Риск», advisory «Рекомендация» | «Внимание», «Предупреждение» | Messaging |
| `src/lib/notify/i18n.ts:44` | score: «Պատրաստվածության միավոր» / «Балл готовности» / "Inspection-Ready Score" | «Ստուգման պատրաստվածություն» / «Готовность к проверке» / "Inspection readiness" | Messaging |
| `src/lib/notify/i18n.ts:45` | hy alertSubject «Նոր ահազանգ», ru «Новое оповещение» | «Նոր զգուշացում», «Новое уведомление» | Messaging |
| `src/lib/notify/i18n.ts:47-48` | «Բաց հարցեր» / «Открытые замечания» / "Open findings" | «Բաց խնդիրներ» / «Открытые проблемы» / "Open issues"; hy noFindings «Բաց խնդիրներ չկան։ Այդպես շարունակեք։», ru «Открытых проблем нет. Так держать!» | Messaging |
| `src/lib/notify/messages.ts:79,87,133,157` | "Tesuch · …" in all locales | Use the local name: «Տեսուչ» (hy), «Тесуч» (ru), "Tesuch" (en) | Messaging |
| `src/lib/pdf/documents.ts:215-216` | table header «Հարց» / «Замечание» | «Խնդիր» / «Проблема» | Documents |
| `src/lib/pdf/documents.ts:209` | «Աշխատանքային տեսչության ստուգմանը պատրաստվածության ստուգաթերթ» | «Աշխատանքային տեսչության ստուգման պատրաստվածության ստուգաթերթ» | Documents. Use the genitive, not the dative. |
| `src/lib/pdf/documents.ts:219` | «Ստեղծված է Tesuch-ով» / «Создано в Tesuch» | «Ստեղծված է Տեսուչ համակարգով» / «Создано в Тесуче» | Documents |
| `src/components/locale-switcher.tsx:13` | `aria-label="Language"` (English in every locale) | `t("common.language")` | Platform. Update the e2e selector `tests/e2e/public.spec.ts:52` in the same change. |
| `src/app/[locale]/app/app-nav.tsx:19` | `aria-label="App"` | add key `app.nav.label` («Հավելվածի ընտրացանկ» / «Меню приложения» / "App") | Product. Update the e2e selectors in `tests/e2e/auth.spec.ts` and `import.spec.ts`, which use `name: "App"`. |
| `src/components/theme-preview.tsx:47` | `aria-label="Theme mode"` | use the `group` label from `mode-toggle.tsx` («Գունային ռեժիմ» / «Цветовой режим») | Design |
| `src/components/theme/mode-toggle.tsx:9-10` | inline hy/ru/en dictionary | move to `themes.json` (Localization will add the keys on request) | Design |
| `src/lib/quiz/quiz.ts:140-153` | badge titles inline | (wording OK) consider moving to `quiz.json` | Product |

## Telegram bot replies: `src/lib/notify/commands.ts` (Messaging)

The Armenian and Russian replies read naturally and the punctuation is correct (։ ՝ « »). The fixes below are about terminology only: score = ցուցանիշ / показатель, finding = խնդիր / проблема / issue, firm = ֆիրմա / фирма / firm, alert = զգուշացում / уведомление.

| Line | Key | Now | Proposed |
|---|---|---|---|
| 79–81 | `helpStatus` | «…պատրաստվածության միավորը և բաց հարցերը» / «…балл готовности и открытые замечания» / "…Inspection-Ready Score and open findings" | «ընկերությունները, ստուգման պատրաստվածության ցուցանիշը և բաց խնդիրները» / «компании, показатель готовности к проверке и открытые проблемы» / "your companies, inspection readiness score and open issues" |
| 83 | `helpIssues` | «5 առաջնային բաց հարցերը» / «топ-5 открытых замечаний» / "top 5 open findings" | «5 ամենակարևոր բաց խնդիրները» / «5 главных открытых проблем» / "top 5 open issues" |
| 77 | `helpTitle` (ru) | Команды бота Тесуч | Команды бота «Тесуч» |
| 88 | `stopped` (hy) | …Այլևս ծանուցումներ չեք ստանա։… | …Այստեղ այլևս զգուշացումներ չեք ստանա։… |
| 93–95 | `noOrg` | «…որևէ կազմակերպության անդամ չեք» / «…ни в одной организации» / "…any organisation yet" | «Դուք դեռ որևէ ֆիրմայի անդամ չեք։» / «Вы пока не состоите ни в одной фирме.» / "You are not a member of any firm yet." |
| 98 | `accounting_firm` (hy) | Հաշվապահական ընկերություն | Հաշվապահական ֆիրմա |
| 100 | `average` | «Միջին միավոր» / «Средний балл» | «Միջին ցուցանիշ» / «Средний показатель», matching `dashboard.firmScore` |
| 108 | `usage` (hy) | Օգտագործում՝ /issues… | Օգտագործման ձևը՝ /issues… |
| 121 | `help` fallback | "Տեսուչ · Тесуч · Tesuch …" | OK. The trilingual fallback is correct and consistent. |

Also check that the bot uses the same severity labels as `src/lib/notify/i18n.ts` after the fixes above: «Ուշադրություն» / «Внимание» and «Նախազգուշական» / «Предупреждение».

## Legal (docs/legal/DISCLAIMER.md)

- The ru footer text starts with "Tesuch —". All other ru UI now uses the Cyrillic name «Тесуч», and `landing.footer.disclaimer` (ru) was changed to «Тесуч — …». Please make the same change in the legal source text.
