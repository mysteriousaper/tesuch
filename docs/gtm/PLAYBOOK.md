# Launch playbook

> No payments in the product. Pilots are free; any later billing is manual and outside the app.

## 30-day launch plan
| Week | Goals | Actions |
|---|---|---|
| **1: Ready** | Demo works, list ready | Demo org with fictional data; 60 qualified firms in `PROSPECTS.md`; landing page + free self-check live on vercel.app; disclaimer in place; lawyer partner contacted |
| **2: Outreach** | 25 firms contacted, 6 demos | 5 cold emails a day (hy/ru); join 3–5 accountant communities and answer questions; post the self-check once per group, if group rules allow |
| **3: Pilots** | 3–5 pilots started | Onboarding call per pilot: import their first client in the call; connect Telegram; agree on a 60-day goal (score +15) |
| **4: Learn** | Pilots active, first proof | Weekly 15-min check-in; collect false positives for the lawyer; first case study draft (with permission); decide pricing for after the pilot |

## Demo script (20 minutes)
1. **Question (2 min).** "How many of your clients would pass a labour inspection tomorrow? How do you know?"
2. **Firm dashboard (3 min).** Companies sorted by score; the red and amber ones are at the top.
3. **One company (5 min).** Findings list: probation over the limit, a fixed-term contract ending in 9 days, missing termination ground. Each shows its article and an arlis.am link, plus the "advisory, not legal advice" label.
4. **Employee timeline (3 min).** Contract start, probation end, leave, deadlines.
5. **Fix it (3 min).** Generate the PDF order in Armenian → mark fixed → score goes up.
6. **Telegram (2 min).** Weekly digest on the phone.
7. **Close (2 min).** "60 days free for the first 10 firms. Can we import one of your clients now?"

## Cold email: Armenian
**Թեմա՝** Ձեր հաճախորդներից ո՞րը կանցներ աշխատանքի տեսչության ստուգումը

Հարգելի՛ [Ընկերության անվանում] թիմ,

Գրում եմ «Տեսուչ» ծառայությունից։ Մենք օգնում ենք հաշվապահական ընկերություններին մեկ էկրանում տեսնել, թե հաճախորդներից որոնք կունենան խնդիրներ աշխատանքի տեսչության ստուգման ժամանակ։

Բեռնում եք աշխատակիցների ցուցակը (CSV կամ Excel), իսկ «Տեսուչը» հաշվում է Աշխատանքային օրենսգրքով սահմանված ժամկետները (փորձաշրջան, որոշակի ժամկետով պայմանագրեր, ծանուցումներ, արձակուրդներ) և նախապես հիշեցնում Telegram-ով կամ էլ. փոստով։ Յուրաքանչյուր ընկերություն ստանում է ստուգման պատրաստվածության գնահատական՝ 0-ից 100։

Առաջին 10 ընկերությունների համար փորձնական շրջանը 60 օր անվճար է։ Հարմա՞ր է այս շաբաթ 20 րոպեանոց ցուցադրություն անցկացնել։

Հարգանքով՝
[Անուն Ազգանուն], «Տեսուչ»
[Հեռախոս]

## Cold email: Russian
**Тема:** Кто из ваших клиентов прошёл бы проверку инспекции труда?

Здравствуйте!

Меня зовут [Имя], я из Tesuch (Տեսուչ). Мы помогаем бухгалтерским компаниям видеть на одном экране, у каких клиентов возникнут проблемы при проверке инспекции труда.

Вы загружаете список сотрудников из CSV или Excel, а Tesuch сам считает сроки по Трудовому кодексу (испытательный срок, срочные договоры, предупреждения об увольнении, отпуска) и заранее напоминает в Telegram или на почту. У каждой компании есть оценка готовности к проверке от 0 до 100.

Первым 10 компаниям даём 60 дней бесплатно. Найдётся 20 минут на этой неделе, чтобы я показал, как это работает?

С уважением,
[Имя Фамилия], Tesuch
[Телефон]

## Telegram message (warm contact or after a group conversation)
**Armenian**
> Բարև Ձեզ, [Անուն]։ [Անուն]-ն եմ «Տեսուչից»։ Ստեղծել ենք գործիք, որը հաշվապահական ընկերություններին ցույց է տալիս, թե որ հաճախորդներն են ռիսկի տակ աշխատանքի տեսչության ստուգման դեպքում, և ժամանակին հիշեցնում է ժամկետների մասին։ Առաջին 10 ընկերությունների համար՝ 60 օր անվճար։ Կարո՞ղ եմ ուղարկել 2 րոպեանոց տեսանյութ։

**Russian**
> Здравствуйте, [Имя]! Я [Имя] из Tesuch. Мы сделали сервис, который показывает бухгалтерским компаниям, какие клиенты рискуют на проверке инспекции труда, и вовремя напоминает о сроках. Первым 10 компаниям — 60 дней бесплатно. Можно отправлю короткое видео на 2 минуты?

Send Telegram messages only to people you already talk to, or who joined a conversation with you. No mass messaging.

## Objection handling
| Objection | Answer |
|---|---|
| **"ArmSoft already does HR."** | ArmSoft keeps the records and runs payroll; Tesuch checks them. It reads your existing export, finds what an inspector would find, and alerts you before a deadline passes, across all your clients on one screen. Keep ArmSoft; Tesuch sits next to it. |
| **"Is this legal advice?"** | No. Tesuch is an information tool: it applies published Labour Code requirements to your data and shows the source article with a link to arlis.am. Rules not yet confirmed by our partner lawyer are marked as advisory. For decisions, consult a lawyer; we can introduce one. |
| | 🇦🇲 «Ոչ։ «Տեսուչը» տեղեկատվական գործիք է․ այն կիրառում է Աշխատանքային օրենսգրքի հրապարակված պահանջները Ձեր տվյալների նկատմամբ և ցույց է տալիս աղբյուրը՝ arlis.am-ի հղումով։ Իրավաբանական որոշումների համար խորհրդակցեք իրավաբանի հետ։» |
| | 🇷🇺 «Нет. Tesuch — информационный инструмент: он применяет опубликованные требования Трудового кодекса к вашим данным и показывает источник со ссылкой на arlis.am. По юридическим решениям консультируйтесь с юристом — можем порекомендовать.» |
| **"Our data is sensitive."** | Data stays in an EU-region database. Each firm's data is isolated at the database level and tested for it. We store only what the rules need (no salaries or passport data), and every change is logged. A DPA is available. |
| **"We already track this in Excel."** | Excel doesn't alert you, doesn't know the rules and doesn't scale to 30 clients. Import that same Excel file and see what it finds in 10 minutes. |
| **"No time to set it up."** | We import your first client with you on the call. |
| **"How much?"** | Free for 60 days for the first 10 firms. Pricing after the pilot will be per client company, and we'll agree it together before day 60. |

## Lawyer partner (revenue share)
- **Who:** an Armenian labour lawyer or small law firm with SME clients.
- **They give:** verification of every rule against arlis.am (article, wording, edge cases), the disclaimer, and consent/DPA review; a named "reviewed by" credit on verified rules; referrals.
- **They get:** a revenue share on referred customers (percentage to agree), plus a "Talk to a lawyer" button on findings that routes paid consultations to them (outside the product; no payments in the app).
- **Terms to agree in writing:** review turnaround, liability limits, how rule updates are handled when the law changes, exclusivity (avoid at first).
