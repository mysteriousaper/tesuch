/**
 * Data Processing Agreement template, bilingual (English | Armenian), from docs/legal/DPA_DRAFT.md.
 * DRAFT pending a licensed Armenian lawyer. No article numbers on purpose. Values in [square brackets]
 * are placeholders the lawyer and the parties fill in. Keep in sync with the markdown draft.
 */
export interface Bilingual {
  en: string;
  hy: string;
}

export interface DpaClause {
  title: Bilingual;
  body: Bilingual;
}

export const DPA_TITLE: Bilingual = {
  en: "Data Processing Agreement",
  hy: "Անձնական տվյալների մշակման պայմանագիր",
};

export const DPA_PARTIES: Bilingual = {
  en: "[Customer] (an employer, or an accounting firm acting for employers), the “Customer”, which determines the purposes of processing; and [Tesuch legal entity], “Tesuch”, which processes data on the Customer’s behalf.",
  hy: "[Պատվիրատու] (գործատու կամ գործատուների անունից գործող հաշվապահական ընկերություն), այսուհետ՝ «Պատվիրատու», որը սահմանում է մշակման նպատակները, և [«Տեսուչ»-ի իրավաբանական անձ], այսուհետ՝ «Տեսուչ», որը տվյալները մշակում է Պատվիրատուի անունից։",
};

export const DPA_CLAUSES: DpaClause[] = [
  {
    title: { en: "Subject", hy: "Առարկա" },
    body: {
      en: "Tesuch processes employee personal data only to provide the service: calculating labour-law deadlines, producing findings, alerts and documents.",
      hy: "«Տեսուչը» աշխատակիցների անձնական տվյալները մշակում է բացառապես ծառայությունը մատուցելու նպատակով՝ աշխատանքային օրենսդրությամբ սահմանված ժամկետների հաշվարկ, խախտումների բացահայտում, ծանուցումներ և փաստաթղթերի ձևավորում։",
    },
  },
  {
    title: { en: "Data and subjects", hy: "Տվյալներ և սուբյեկտներ" },
    body: {
      en: "Employees of the Customer or its clients: first and last name, date of birth, contract type and dates, probation end, leave records, termination date and ground. No salary, ID document, address or contact data of employees.",
      hy: "Պատվիրատուի կամ նրա հաճախորդների աշխատակիցներ՝ անուն, ազգանուն, ծննդյան ամսաթիվ, պայմանագրի տեսակ և ժամկետներ, փորձաշրջանի ավարտ, արձակուրդներ, աշխատանքից ազատման ամսաթիվ և հիմք։ Աշխատավարձ, անձը հաստատող փաստաթղթի տվյալներ, հասցե կամ կոնտակտային տվյալներ չեն մշակվում։",
    },
  },
  {
    title: { en: "Instructions", hy: "Ցուցումներ" },
    body: {
      en: "Tesuch acts only on the Customer’s documented instructions (the service configuration counts as such) and does not use the data for its own purposes, AI training or marketing.",
      hy: "«Տեսուչը» գործում է միայն Պատվիրատուի փաստաթղթավորված ցուցումներով (ծառայության կարգավորումները համարվում են այդպիսին) և տվյալները չի օգտագործում սեփական նպատակներով, արհեստական բանականության ուսուցման կամ մարքեթինգի համար։",
    },
  },
  {
    title: { en: "Legal basis", hy: "Իրավական հիմք" },
    body: {
      en: "The Customer is responsible for having a lawful basis for the processing and for informing employees. Tesuch provides a notice template on request.",
      hy: "Պատվիրատուն պատասխանատու է մշակման իրավաչափ հիմքի առկայության և աշխատակիցներին տեղեկացնելու համար։ «Տեսուչը» պահանջի դեպքում տրամադրում է ծանուցման ձևանմուշ։",
    },
  },
  {
    title: { en: "Security", hy: "Անվտանգություն" },
    body: {
      en: "Encryption in transit and at rest; tenant isolation enforced in the database (row-level security), tested automatically; role-based access; audit log of all changes; least-privilege staff access.",
      hy: "Գաղտնագրում փոխանցման և պահպանման ընթացքում, պատվիրատուների տվյալների մեկուսացում տվյալների բազայի մակարդակում՝ ավտոմատ ստուգումներով, դերերի վրա հիմնված մուտք, բոլոր փոփոխությունների մատյան, աշխատակիցների նվազագույն անհրաժեշտ մուտք։",
    },
  },
  {
    title: { en: "Location and subprocessors", hy: "Գտնվելու վայր և ենթամշակողներ" },
    body: {
      en: "Data is stored in an EU region (Ireland). Subprocessors: Supabase (database, authentication), Vercel (hosting), Resend (email), Telegram (messages, only finding summaries without unnecessary personal data). Tesuch informs the Customer before adding a subprocessor.",
      hy: "Տվյալները պահվում են ԵՄ տարածաշրջանում (Իռլանդիա)։ Ենթամշակողներ՝ Supabase (տվյալների բազա, նույնականացում), Vercel (հոսթինգ), Resend (էլ․ փոստ), Telegram (հաղորդագրություններ՝ միայն խախտումների ամփոփումներ՝ առանց ավելորդ անձնական տվյալների)։ Նոր ենթամշակող ներգրավելուց առաջ «Տեսուչը» տեղեկացնում է Պատվիրատուին։",
    },
  },
  {
    title: { en: "Confidentiality", hy: "Գաղտնիություն" },
    body: {
      en: "Staff with access are bound by confidentiality.",
      hy: "Մուտք ունեցող աշխատակիցները պարտավորված են պահպանել գաղտնիությունը։",
    },
  },
  {
    title: { en: "Data subject requests", hy: "Սուբյեկտների դիմումներ" },
    body: {
      en: "Tesuch helps the Customer answer access, correction and deletion requests within [N] working days.",
      hy: "«Տեսուչը» աջակցում է Պատվիրատուին տվյալներին ծանոթանալու, ուղղելու և ջնջելու դիմումներին պատասխանելիս՝ [N] աշխատանքային օրվա ընթացքում։",
    },
  },
  {
    title: { en: "Breach notification", hy: "Խախտման մասին ծանուցում" },
    body: {
      en: "Tesuch notifies the Customer without undue delay, and no later than [N] hours after becoming aware of a breach.",
      hy: "Տվյալների անվտանգության խախտման մասին «Տեսուչը» Պատվիրատուին տեղեկացնում է անհապաղ, բայց ոչ ուշ, քան այդ մասին իմանալուց [N] ժամ հետո։",
    },
  },
  {
    title: { en: "Retention and deletion", hy: "Պահպանում և ջնջում" },
    body: {
      en: "On termination, Tesuch deletes or returns the data within [30] days, except where law requires retention. Backups expire within [N] days.",
      hy: "Պայմանագրի դադարեցումից հետո «Տեսուչը» [30] օրվա ընթացքում ջնջում կամ վերադարձնում է տվյալները, բացառությամբ օրենքով պահպանման ենթակա դեպքերի։ Պահուստային պատճենները ջնջվում են [N] օրվա ընթացքում։",
    },
  },
  {
    title: { en: "Audit", hy: "Ստուգում" },
    body: {
      en: "The Customer may request reasonable information to verify compliance, once a year or after a breach.",
      hy: "Պատվիրատուն կարող է պահանջել համապատասխանությունը ստուգելու համար անհրաժեշտ ողջամիտ տեղեկություններ՝ տարին մեկ անգամ կամ խախտումից հետո։",
    },
  },
  {
    title: { en: "Liability and law", hy: "Պատասխանատվություն և կիրառելի իրավունք" },
    body: {
      en: "Liability per the main service agreement. Governed by the law of the Republic of Armenia.",
      hy: "Պատասխանատվությունը՝ ըստ ծառայությունների մատուցման հիմնական պայմանագրի։ Կիրառվում է Հայաստանի Հանրապետության օրենսդրությունը։",
    },
  },
];

export const DPA_SIGNATURES: { party: Bilingual; fields: Bilingual[] }[] = [
  {
    party: { en: "Customer", hy: "Պատվիրատու" },
    fields: [
      { en: "Name of organisation", hy: "Կազմակերպության անվանում" },
      { en: "Representative, position", hy: "Ներկայացուցիչ, պաշտոն" },
      { en: "Signature", hy: "Ստորագրություն" },
      { en: "Date", hy: "Ամսաթիվ" },
    ],
  },
  {
    party: { en: "Tesuch", hy: "«Տեսուչ»" },
    fields: [
      { en: "Legal entity", hy: "Իրավաբանական անձ" },
      { en: "Representative, position", hy: "Ներկայացուցիչ, պաշտոն" },
      { en: "Signature", hy: "Ստորագրություն" },
      { en: "Date", hy: "Ամսաթիվ" },
    ],
  },
];
