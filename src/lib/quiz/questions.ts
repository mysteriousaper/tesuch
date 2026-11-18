// Weekly "surprise inspection" questions. Every question is grounded in one rule from rules/*.json;
// nothing here goes beyond what that rule (and the brief it came from) says.
import type { Locale } from "../notify/i18n";

export type L = Record<Locale, string>;

export interface QuizQuestionDef {
  id: string;
  ruleId: string;
  prompt: L;
  options: L[];
  correct: number;
  explanation: L;
}

const ruDays = (n: number) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} день`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} дня`;
  return `${n} дней`;
};
const days = (n: number): L => ({ hy: `${n} օր`, ru: ruDays(n), en: `${n} days` });

const noticeExplanation: L = {
  hy: "Ծանուցման ժամկետը կախված է տվյալ գործատուի մոտ աշխատանքային ստաժից՝ 14, 35, 42, 49 կամ 60 օր։",
  ru: "Срок предупреждения зависит от стажа у данного работодателя: 14, 35, 42, 49 или 60 дней.",
  en: "Notice depends on length of service with this employer: 14, 35, 42, 49 or 60 days.",
};

function noticeQuestion(id: string, service: L, options: number[], correctDays: number): QuizQuestionDef {
  return {
    id,
    ruleId: "notice-period",
    prompt: {
      hy: `Գործատուն ազատում է աշխատողին, որի ստաժը տվյալ գործատուի մոտ ${service.hy} է։ Քանի՞ օր առաջ պետք է ծանուցել։`,
      ru: `Работодатель увольняет работника, у которого стаж у этого работодателя — ${service.ru}. За сколько дней нужно предупредить?`,
      en: `The employer is dismissing an employee with ${service.en} of service with them. How many days' notice are needed?`,
    },
    options: options.map(days),
    correct: options.indexOf(correctDays),
    explanation: noticeExplanation,
  };
}

export const QUESTIONS: QuizQuestionDef[] = [
  {
    id: "q-probation-minor",
    ruleId: "probation-minor",
    prompt: {
      hy: "Կարելի՞ է 17 տարեկան աշխատողին աշխատանքի ընդունել փորձաշրջանով։",
      ru: "Можно ли принять 17-летнего работника с испытательным сроком?",
      en: "Can a 17-year-old be hired with a probation period?",
    },
    options: [
      { hy: "Այո, մինչև 3 ամիս", ru: "Да, до 3 месяцев", en: "Yes, up to 3 months" },
      { hy: "Միայն ծնողի համաձայնությամբ", ru: "Только с согласия родителей", en: "Only with a parent's consent" },
      { hy: "Ոչ, անչափահասի համար փորձաշրջան չի սահմանվում", ru: "Нет, несовершеннолетним испытательный срок не устанавливается", en: "No, minors cannot be put on probation" },
    ],
    correct: 2,
    explanation: {
      hy: "Անչափահասի համար փորձաշրջան չի սահմանվում։",
      ru: "Несовершеннолетним испытательный срок не устанавливается.",
      en: "Minors may not be put on probation.",
    },
  },
  {
    id: "q-probation-age",
    ruleId: "probation-minor",
    prompt: {
      hy: "Քանի՞ տարեկանից կարելի է աշխատողի համար փորձաշրջան սահմանել։",
      ru: "С какого возраста работнику можно установить испытательный срок?",
      en: "From what age can an employee be put on probation?",
    },
    options: [
      { hy: "16 տարեկանից", ru: "С 16 лет", en: "From 16" },
      { hy: "18 տարեկանից", ru: "С 18 лет", en: "From 18" },
      { hy: "21 տարեկանից", ru: "С 21 года", en: "From 21" },
    ],
    correct: 1,
    explanation: {
      hy: "Մինչև 18 տարեկան աշխատողներն անչափահաս են, և նրանց համար փորձաշրջան չի սահմանվում։",
      ru: "Работники до 18 лет несовершеннолетние, и испытательный срок им не устанавливается.",
      en: "Employees under 18 are minors and cannot be put on probation.",
    },
  },
  {
    id: "q-probation-transfer",
    ruleId: "probation-transfer",
    prompt: {
      hy: "Աշխատողը ձեզ մոտ է անցել այլ գործատուից՝ գործատուների համաձայնությամբ փոխադրման կարգով։ Կարելի՞ է նրա համար փորձաշրջան սահմանել։",
      ru: "Работник перешёл к вам от другого работодателя в порядке перевода по соглашению работодателей. Можно ли установить ему испытательный срок?",
      en: "An employee joined you from another employer by a transfer agreed between the employers. Can you set a probation period?",
    },
    options: [
      { hy: "Ոչ", ru: "Нет", en: "No" },
      { hy: "Այո", ru: "Да", en: "Yes" },
      { hy: "Միայն 1 ամսով", ru: "Только на 1 месяц", en: "Only for 1 month" },
    ],
    correct: 0,
    explanation: {
      hy: "Փոխադրման կարգով ընդունված աշխատողի համար փորձաշրջան չի սահմանվում։",
      ru: "Работнику, принятому в порядке перевода, испытательный срок не устанавливается.",
      en: "Employees hired by transfer cannot be put on probation.",
    },
  },
  {
    id: "q-probation-max",
    ruleId: "probation-max",
    prompt: {
      hy: "Սովորական դեպքում ո՞րն է փորձաշրջանի առավելագույն տևողությունը։",
      ru: "Какова максимальная продолжительность испытательного срока в обычном случае?",
      en: "What is the maximum probation period in the normal case?",
    },
    options: [
      { hy: "1 ամիս", ru: "1 месяц", en: "1 month" },
      { hy: "3 ամիս", ru: "3 месяца", en: "3 months" },
      { hy: "6 ամիս", ru: "6 месяцев", en: "6 months" },
    ],
    correct: 1,
    explanation: {
      hy: "Փորձաշրջանը չի կարող գերազանցել 3 ամիսը՝ բացառությամբ օրենքով նախատեսված հատուկ դեպքերի։",
      ru: "Испытательный срок не может превышать 3 месяцев, кроме особых случаев, предусмотренных законом.",
      en: "Probation cannot exceed 3 months, except in special cases set by law.",
    },
  },
  {
    id: "q-probation-special",
    ruleId: "probation-max",
    prompt: {
      hy: "Օրենքով նախատեսված հատուկ դեպքերում ո՞րն է փորձաշրջանի առավելագույն տևողությունը։",
      ru: "Какой максимальный испытательный срок допускается в особых случаях, предусмотренных законом?",
      en: "In the special cases set by law, what is the maximum probation period?",
    },
    options: [
      { hy: "24 ամիս", ru: "24 месяца", en: "24 months" },
      { hy: "6 ամիս", ru: "6 месяцев", en: "6 months" },
      { hy: "12 ամիս", ru: "12 месяцев", en: "12 months" },
    ],
    correct: 2,
    explanation: {
      hy: "Հատուկ դեպքերում փորձաշրջանը կարող է լինել մինչև 12 ամիս։",
      ru: "В особых случаях испытательный срок может составлять до 12 месяцев.",
      en: "In special cases probation can last up to 12 months.",
    },
  },
  {
    id: "q-probation-notice",
    ruleId: "probation-ending",
    prompt: {
      hy: "Փորձաշրջանի ընթացքում աշխատանքային պայմանագիրը լուծելիս քանի՞ օր առաջ պետք է գրավոր ծանուցել։",
      ru: "За сколько дней нужно письменно предупредить о расторжении договора во время испытательного срока?",
      en: "How many days' written notice is needed to end employment during probation?",
    },
    options: [days(1), days(3), days(14)],
    correct: 1,
    explanation: {
      hy: "Փորձաշրջանի ընթացքում պայմանագիրը լուծելու մասին պետք է գրավոր ծանուցել առնվազն 3 օր առաջ։",
      ru: "О расторжении договора во время испытательного срока нужно письменно предупредить не менее чем за 3 дня.",
      en: "Give at least 3 days' written notice to end employment during probation.",
    },
  },
  {
    id: "q-fixed-term-ground",
    ruleId: "fixed-term-ground",
    prompt: {
      hy: "Կարելի՞ է ցանկացած աշխատողի հետ որոշակի ժամկետով պայմանագիր կնքել առանց հիմքի։",
      ru: "Можно ли заключить срочный трудовой договор с любым работником без основания?",
      en: "Can you sign a fixed-term contract with any employee, without a ground?",
    },
    options: [
      { hy: "Այո, դա գործատուի ընտրությունն է", ru: "Да, это выбор работодателя", en: "Yes, it's the employer's choice" },
      { hy: "Այո, եթե ժամկետը 1 տարուց պակաս է", ru: "Да, если срок меньше года", en: "Yes, if it's shorter than a year" },
      { hy: "Ոչ, անհրաժեշտ է օրենքով նախատեսված հիմք", ru: "Нет, нужно предусмотренное законом основание", en: "No, a lawful ground is required" },
    ],
    correct: 2,
    explanation: {
      hy: "Որոշակի ժամկետով պայմանագիր կնքվում է միայն օրենքով նախատեսված հիմքով, և այդ հիմքը պետք է նշված լինի։",
      ru: "Срочный договор заключается только при наличии законного основания, и это основание нужно указать.",
      en: "A fixed-term contract needs a lawful ground, and the ground must be stated.",
    },
  },
  {
    id: "q-fixed-term-ending",
    ruleId: "fixed-term-ending",
    prompt: {
      hy: "Ի՞նչ պետք է հետևել որոշակի ժամկետով պայմանագրի դեպքում, որպեսզի ոչինչ բաց չթողնեք։",
      ru: "За чем нужно следить по срочному договору, чтобы ничего не упустить?",
      en: "What must you track for a fixed-term contract so nothing slips?",
    },
    options: [
      { hy: "Պայմանագրի ավարտի ամսաթիվը", ru: "Дату окончания договора", en: "The contract end date" },
      { hy: "Աշխատողի ծննդյան օրը", ru: "День рождения работника", en: "The employee's birthday" },
      { hy: "Գրասենյակի հասցեն", ru: "Адрес офиса", en: "The office address" },
    ],
    correct: 0,
    explanation: {
      hy: "Tesuch-ը նախապես հիշեցնում է պայմանագրի ավարտի մասին, որպեսզի ժամանակին որոշում կայացնեք։",
      ru: "Tesuch заранее напоминает об окончании договора, чтобы вы успели принять решение.",
      en: "Tesuch reminds you before the end date so you can decide in time.",
    },
  },
  {
    id: "q-termination-ground",
    ruleId: "termination-ground",
    prompt: {
      hy: "Պե՞տք է արդյոք աշխատանքից ազատելու հրամանում նշել պայմանագրի լուծման հիմքը։",
      ru: "Нужно ли указывать основание расторжения договора в приказе об увольнении?",
      en: "Must the dismissal order state the ground for ending the contract?",
    },
    options: [
      { hy: "Ոչ", ru: "Нет", en: "No" },
      { hy: "Այո, միշտ", ru: "Да, всегда", en: "Yes, always" },
      { hy: "Միայն աշխատողի խնդրանքով", ru: "Только по просьбе работника", en: "Only if the employee asks" },
    ],
    correct: 1,
    explanation: {
      hy: "Աշխատանքային պայմանագրի լուծման հիմքը պետք է նշվի։",
      ru: "Основание расторжения трудового договора должно быть указано.",
      en: "The ground for ending the employment contract must be stated.",
    },
  },
  {
    id: "q-leave-five-day",
    ruleId: "annual-leave-min",
    prompt: {
      hy: "Հնգօրյա աշխատանքային շաբաթի դեպքում ո՞րն է նվազագույն տարեկան արձակուրդը։",
      ru: "Каков минимальный ежегодный отпуск при пятидневной рабочей неделе?",
      en: "What is the minimum annual leave on a five-day week?",
    },
    options: [
      { hy: "15 աշխատանքային օր", ru: "15 рабочих дней", en: "15 working days" },
      { hy: "20 աշխատանքային օր", ru: "20 рабочих дней", en: "20 working days" },
      { hy: "28 օրացուցային օր", ru: "28 календарных дней", en: "28 calendar days" },
    ],
    correct: 1,
    explanation: {
      hy: "Հնգօրյա շաբաթի դեպքում՝ առնվազն 20 աշխատանքային օր։",
      ru: "При пятидневной неделе — не менее 20 рабочих дней.",
      en: "On a five-day week: at least 20 working days.",
    },
  },
  {
    id: "q-leave-six-day",
    ruleId: "annual-leave-min",
    prompt: {
      hy: "Վեցօրյա աշխատանքային շաբաթի դեպքում ո՞րն է նվազագույն տարեկան արձակուրդը։",
      ru: "Каков минимальный ежегодный отпуск при шестидневной рабочей неделе?",
      en: "What is the minimum annual leave on a six-day week?",
    },
    options: [
      { hy: "24 աշխատանքային օր", ru: "24 рабочих дня", en: "24 working days" },
      { hy: "20 աշխատանքային օր", ru: "20 рабочих дней", en: "20 working days" },
      { hy: "30 աշխատանքային օր", ru: "30 рабочих дней", en: "30 working days" },
    ],
    correct: 0,
    explanation: {
      hy: "Վեցօրյա շաբաթի դեպքում՝ առնվազն 24 աշխատանքային օր։",
      ru: "При шестидневной неделе — не менее 24 рабочих дней.",
      en: "On a six-day week: at least 24 working days.",
    },
  },
  {
    id: "q-leave-unit",
    ruleId: "annual-leave-min",
    prompt: {
      hy: "Ինչո՞վ է հաշվարկվում նվազագույն տարեկան արձակուրդը։",
      ru: "В чём считается минимальный ежегодный отпуск?",
      en: "How is the minimum annual leave counted?",
    },
    options: [
      { hy: "Օրացուցային օրերով", ru: "В календарных днях", en: "In calendar days" },
      { hy: "Շաբաթներով", ru: "В неделях", en: "In weeks" },
      { hy: "Աշխատանքային օրերով", ru: "В рабочих днях", en: "In working days" },
    ],
    correct: 2,
    explanation: {
      hy: "Նվազագույն տարեկան արձակուրդը հաշվարկվում է աշխատանքային օրերով՝ 20 կամ 24։",
      ru: "Минимальный ежегодный отпуск считается в рабочих днях: 20 или 24.",
      en: "It is counted in working days: 20 or 24.",
    },
  },
  {
    id: "q-leave-cash",
    ruleId: "leave-cash-swap",
    prompt: {
      hy: "Աշխատողը խնդրում է արձակուրդի փոխարեն գումար վճարել և շարունակում է աշխատել։ Կարելի՞ է։",
      ru: "Работник просит выплатить деньги вместо отпуска и продолжает работать. Так можно?",
      en: "An employee asks for money instead of leave and keeps working. Is that allowed?",
    },
    options: [
      { hy: "Այո, եթե աշխատողը համաձայն է", ru: "Да, если работник согласен", en: "Yes, if the employee agrees" },
      { hy: "Ոչ, տարեկան արձակուրդը չի կարող փոխարինվել դրամով", ru: "Нет, ежегодный отпуск нельзя заменить деньгами", en: "No, annual leave cannot be replaced with money" },
      { hy: "Այո, բայց միայն արձակուրդի կեսը", ru: "Да, но только половину отпуска", en: "Yes, but only half of the leave" },
    ],
    correct: 1,
    explanation: {
      hy: "Քանի դեռ աշխատողը շարունակում է աշխատել, տարեկան արձակուրդը չի կարող փոխարինվել դրամով։",
      ru: "Пока работник продолжает работать, ежегодный отпуск нельзя заменить денежной компенсацией.",
      en: "While the employee keeps working, annual leave cannot be swapped for money.",
    },
  },
  noticeQuestion("q-notice-under-1", { hy: "1 տարուց պակաս", ru: "меньше года", en: "less than 1 year" }, [7, 14, 30], 14),
  noticeQuestion("q-notice-1-5", { hy: "3 տարի", ru: "3 года", en: "3 years" }, [35, 14, 60], 35),
  noticeQuestion("q-notice-5-10", { hy: "7 տարի", ru: "7 лет", en: "7 years" }, [35, 49, 42], 42),
  noticeQuestion("q-notice-10-15", { hy: "12 տարի", ru: "12 лет", en: "12 years" }, [49, 42, 60], 49),
  noticeQuestion("q-notice-15-plus", { hy: "20 տարի", ru: "20 лет", en: "20 years" }, [90, 49, 60], 60),
  {
    id: "q-notice-reduction",
    ruleId: "notice-period",
    prompt: {
      hy: "Աշխատողների թվաքանակի կրճատման դեպքում որքա՞ն ժամանակ առաջ պետք է ծանուցել աշխատողին։",
      ru: "За какой срок нужно предупредить работника при сокращении численности?",
      en: "How far ahead must you notify an employee of a workforce reduction?",
    },
    options: [
      { hy: "1 ամիս", ru: "За 1 месяц", en: "1 month" },
      { hy: "2 ամիս", ru: "За 2 месяца", en: "2 months" },
      { hy: "6 ամիս", ru: "За 6 месяцев", en: "6 months" },
    ],
    correct: 1,
    explanation: {
      hy: "Կրճատման դեպքում աշխատողին պետք է ծանուցել առնվազն 2 ամիս առաջ։",
      ru: "При сокращении работника нужно предупредить не менее чем за 2 месяца.",
      en: "For a workforce reduction, notify the employee at least 2 months ahead.",
    },
  },
  {
    id: "q-maternity",
    ruleId: "maternity-min",
    prompt: {
      hy: "Ո՞րն է հղիության և ծննդաբերության արձակուրդի հիմնական տևողությունը։",
      ru: "Какова базовая продолжительность отпуска по беременности и родам?",
      en: "What is the base length of maternity leave?",
    },
    options: [days(70), days(180), days(140)],
    correct: 2,
    explanation: {
      hy: "Հիմնական տևողությունը 140 օր է, իսկ որոշ դեպքերում՝ 155 կամ 180 օր։",
      ru: "Базовая продолжительность — 140 дней, в отдельных случаях — 155 или 180 дней.",
      en: "The base length is 140 days; 155 or 180 days in certain cases.",
    },
  },
  {
    id: "q-src-registration",
    ruleId: "src-registration",
    prompt: {
      hy: "Որտե՞ղ պետք է գրանցվեն աշխատանքային պայմանագրերը։",
      ru: "Где должны регистрироваться трудовые договоры?",
      en: "Where must employment contracts be registered?",
    },
    options: [
      { hy: "ՊԵԿ էլեկտրոնային հարթակում", ru: "На электронной платформе КГД", en: "On the SRC e-platform" },
      { hy: "Համայնքապետարանում", ru: "В мэрии", en: "At the municipality" },
      { hy: "Գրանցում պետք չէ", ru: "Регистрация не нужна", en: "No registration is needed" },
    ],
    correct: 0,
    explanation: {
      hy: "Պայմանագրերը գրանցվում են ՊԵԿ էլեկտրոնային հարթակում։ Պարտադիր դառնալու ժամկետը դեռ ճշտվում է։",
      ru: "Договоры регистрируются на электронной платформе КГД. Срок, с которого это обязательно, ещё уточняется.",
      en: "Contracts are registered on the SRC e-platform. The date it becomes mandatory is still being clarified.",
    },
  },
];
