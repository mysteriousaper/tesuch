// HR order templates (Armenian) and the inspection-readiness checklist (hy/ru/en).
// Templates are drafts: every page carries a "verify with a lawyer" footer, and article numbers
// are printed only when the rule JSON has one.
// Written with createElement (no JSX) so the module runs unchanged in Next.js and in vitest.
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement, type ReactNode } from "react";
import { citation, coverageLine, rulesReviewedLine, DISCLAIMER, formatDate, ruleById, SEVERITY_LABEL, T, type Locale } from "../notify/i18n";
import type { Finding, IsoDate } from "../rules/types";
import { FONT_STACK } from "./fonts";
import { noticePlan } from "./notice";

type DocElement = ReactElement<React.ComponentProps<typeof Document>>;

const s = StyleSheet.create({
  page: { fontFamily: FONT_STACK, fontSize: 11, paddingTop: 48, paddingBottom: 72, paddingHorizontal: 56, color: "#1a1a1a" },
  // lineHeight lives here, not on Page: on Page it hides the fixed footer (react-pdf 4.x).
  content: { lineHeight: 1.5 },
  company: { fontSize: 10, color: "#444", marginBottom: 24 },
  title: { fontSize: 15, fontWeight: 700, textAlign: "center" },
  subtitle: { fontSize: 11, fontWeight: 700, textAlign: "center", marginTop: 4, marginBottom: 20 },
  metaRow: { flexDirection: "row", marginBottom: 2 },
  metaLabel: { width: 220, color: "#444" },
  metaValue: { flex: 1, fontWeight: 700 },
  para: { marginTop: 10 },
  strong: { fontWeight: 700 },
  basis: { marginTop: 16, fontSize: 9, color: "#444" },
  warning: { marginTop: 12, padding: 8, borderWidth: 1, borderColor: "#b42318", color: "#b42318", fontSize: 10 },
  signatures: { marginTop: 36 },
  signLine: { marginTop: 18 },
  footer: { position: "absolute", left: 56, right: 56, bottom: 28, fontSize: 8, color: "#b42318", borderTopWidth: 0.5, borderTopColor: "#b42318", paddingTop: 4 },
  footerNeutral: { position: "absolute", left: 56, right: 56, bottom: 28, fontSize: 8, color: "#555", borderTopWidth: 0.5, borderTopColor: "#999", paddingTop: 4 },
  th: { lineHeight: 1.3, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#1a1a1a", paddingBottom: 4, marginTop: 16, fontWeight: 700, fontSize: 9 },
  tr: { lineHeight: 1.3, flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 5, fontSize: 9 },
  box: { width: 10, height: 10, borderWidth: 1, borderColor: "#1a1a1a", marginTop: 2, marginRight: 8 },
});

const BLANK = "________________";
const v = (x: string | null | undefined) => (x && x.trim() ? x : BLANK);
const d = (x: IsoDate | null | undefined) => (x ? formatDate(x) : BLANK);
type TextProps = React.ComponentProps<typeof Text>;
const txt = (style: TextProps["style"], ...children: ReactNode[]) => h(Text, { style } as TextProps, ...children);

export interface CompanyInfo {
  name: string;
  taxId?: string | null;
  directorName?: string | null;
}
export interface EmployeeInfo {
  name: string;
  position?: string | null;
}

export const DRAFT_FOOTER = "Սևագիր ձևանմուշ․ օգտագործելուց առաջ ստուգեք իրավաբանի հետ։ · DRAFT template — verify with a lawyer.";

function orderDoc(title: string, company: CompanyInfo, children: ReactNode[]): DocElement {
  return h(
    Document,
    { title, language: "hy" },
    h(
      Page,
      { size: "A4", style: s.page },
      h(View, { style: s.content }, txt(s.company, company.name, company.taxId ? ` · ՀՎՀՀ՝ ${company.taxId}` : ""), ...children),
      h(Text, { style: s.footer, fixed: true, render: ({ pageNumber, totalPages }) => `${DRAFT_FOOTER} · ${rulesReviewedLine("hy")}   ${pageNumber}/${totalPages}` }),
    ),
  );
}

function meta(rows: [string, string][]) {
  return h(View, null, ...rows.map(([label, value]) => h(View, { key: label, style: s.metaRow }, txt(s.metaLabel, label), txt(s.metaValue, value))));
}

const basis = (ruleId: string, label = "Հիմք՝") => txt(s.basis, `${label} ${citation(ruleById(ruleId), "hy")}`);

function signatures(company: CompanyInfo, employee: EmployeeInfo, employeeLine: string) {
  return h(
    View,
    { style: s.signatures },
    txt(s.signLine, `Տնօրեն՝ ${BLANK} /${v(company.directorName)}/`),
    txt(s.signLine, `${employeeLine} ${BLANK} /${employee.name}/`),
    txt(s.signLine, `Ամսաթիվ՝ ${BLANK}`),
  );
}

// ---------- Probation result order ----------

export interface ProbationOrderData {
  company: CompanyInfo;
  employee: EmployeeInfo;
  contractStart: IsoDate;
  probationEnd: IsoDate;
  decision: "confirm" | "terminate";
  orderNo?: string | null;
  orderDate?: IsoDate | null;
  terminationDate?: IsoDate | null;
}

export function probationOrder(p: ProbationOrderData): DocElement {
  const confirm = p.decision === "confirm";
  const body = confirm
    ? [
        txt(s.para, "Հաշվի առնելով փորձաշրջանի դրական արդյունքները՝"),
        txt([s.para, s.strong], "ՀՐԱՄԱՅՈՒՄ ԵՄ՝"),
        txt(s.para, "1. Աշխատողին համարել փորձաշրջանը հաջողությամբ անցած։"),
        txt(undefined, "2. Աշխատանքային հարաբերությունները շարունակել կնքված աշխատանքային պայմանագրի պայմաններով։"),
      ]
    : [
        txt(s.para, "Հաշվի առնելով փորձաշրջանի անբավարար արդյունքները՝"),
        txt([s.para, s.strong], "ՀՐԱՄԱՅՈՒՄ ԵՄ՝"),
        txt(s.para, "1. Աշխատողի հետ աշխատանքային պայմանագիրը լուծել փորձաշրջանի անբավարար արդյունքների հիմքով։"),
        txt(undefined, `2. Պայմանագրի լուծման օր՝ ${d(p.terminationDate)}։`),
        txt(undefined, "3. Աշխատողին գրավոր ծանուցել պայմանագրի լուծման մասին առնվազն 3 օր առաջ։"),
        basis("probation-ending"),
      ];
  return orderDoc(`Հրաման — ${p.employee.name}`, p.company, [
    txt(s.title, `ՀՐԱՄԱՆ № ${v(p.orderNo)}`),
    txt(
      s.subtitle,
      confirm
        ? "Փորձաշրջանի արդյունքներով աշխատողին աշխատանքում հաստատելու մասին"
        : "Փորձաշրջանի արդյունքներով աշխատանքային պայմանագիրը լուծելու մասին",
    ),
    meta([
      ["Հրամանի ամսաթիվ՝", d(p.orderDate)],
      ["Աշխատող՝", p.employee.name],
      ["Պաշտոն՝", v(p.employee.position)],
      ["Աշխատանքի ընդունման օր՝", d(p.contractStart)],
      ["Փորձաշրջանի ավարտ՝", d(p.probationEnd)],
    ]),
    ...body,
    signatures(p.company, p.employee, "Հրամանին ծանոթացա՝"),
  ]);
}

// ---------- Fixed-term contract end notice ----------

export interface FixedTermEndNoticeData {
  company: CompanyInfo;
  employee: EmployeeInfo;
  contractStart?: IsoDate | null;
  contractEnd: IsoDate;
  noticeDate?: IsoDate | null;
}

export function fixedTermEndNotice(p: FixedTermEndNoticeData): DocElement {
  return orderDoc(`Ծանուցում — ${p.employee.name}`, p.company, [
    txt(s.title, "ԾԱՆՈՒՑՈՒՄ"),
    txt(s.subtitle, "Որոշակի ժամկետով աշխատանքային պայմանագրի գործողության ժամկետը լրանալու մասին"),
    meta([
      ["Ծանուցման ամսաթիվ՝", d(p.noticeDate)],
      ["Աշխատող՝", p.employee.name],
      ["Պաշտոն՝", v(p.employee.position)],
      ["Պայմանագրի կնքման օր՝", d(p.contractStart)],
      ["Պայմանագրի գործողության ավարտ՝", d(p.contractEnd)],
    ]),
    txt(s.para, `Հարգելի՛ ${p.employee.name},`),
    txt(s.para, `Տեղեկացնում ենք, որ Ձեզ հետ կնքված որոշակի ժամկետով աշխատանքային պայմանագրի գործողության ժամկետը լրանում է ${d(p.contractEnd)}-ին։`),
    txt(s.para, "Խնդրում ենք մինչև նշված օրը կապ հաստատել անձնակազմի կառավարման ստորաբաժանման հետ՝ պայմանագրի հետագա ընթացքը քննարկելու համար։"),
    basis("fixed-term-ending"),
    signatures(p.company, p.employee, "Ծանուցումը ստացա՝"),
  ]);
}

// ---------- Dismissal notice ----------

export interface DismissalNoticeData {
  company: CompanyInfo;
  employee: EmployeeInfo;
  serviceStart: IsoDate;
  noticeDate: IsoDate;
  /** Defaults to the earliest date the notice period allows. */
  terminationDate?: IsoDate | null;
  ground?: string | null;
  workforceReduction: boolean;
}

export function dismissalNotice(p: DismissalNoticeData): DocElement {
  const plan = noticePlan(p.serviceStart, p.noticeDate, p.workforceReduction);
  const termination = p.terminationDate ?? plan.earliestTermination;
  const tooEarly = termination < plan.earliestTermination;
  const period = "days" in plan.period ? `${plan.period.days} օր` : `${plan.period.months} ամիս`;
  return orderDoc(`Ծանուցում — ${p.employee.name}`, p.company, [
    txt(s.title, "ԾԱՆՈՒՑՈՒՄ"),
    txt(s.subtitle, "Աշխատանքային պայմանագիրը լուծելու մասին"),
    meta([
      ["Աշխատող՝", p.employee.name],
      ["Պաշտոն՝", v(p.employee.position)],
      ["Աշխատանքի ընդունման օր՝", d(p.serviceStart)],
      ["Ծանուցման օր՝", d(p.noticeDate)],
      ["Ծանուցման նվազագույն ժամկետ՝", period],
      ["Լուծման ամենավաղ օր՝", d(plan.earliestTermination)],
      ["Պայմանագրի լուծման օր՝", d(termination)],
      ["Լուծման հիմք՝", v(p.ground)],
    ]),
    ...(tooEarly
      ? [txt(s.warning, `Ուշադրություն․ պայմանագրի լուծման օրն ավելի վաղ է, քան թույլ է տալիս ծանուցման նվազագույն ժամկետը։ Ամենավաղ օրը՝ ${d(plan.earliestTermination)}։`)]
      : []),
    txt(s.para, `Հարգելի՛ ${p.employee.name},`),
    txt(s.para, `Տեղեկացնում ենք, որ Ձեզ հետ կնքված աշխատանքային պայմանագիրը լուծվելու է ${d(termination)}-ին՝ վերը նշված հիմքով։`),
    basis("notice-period", "Ծանուցման ժամկետների հիմք՝"),
    basis("termination-ground", "Լուծման հիմքը նշելու պահանջ՝"),
    signatures(p.company, p.employee, "Ծանուցումը ստացա՝"),
  ]);
}

// ---------- Inspection readiness checklist (hy/ru/en) ----------

const CL = {
  title: {
    hy: "Աշխատանքային տեսչության ստուգմանը պատրաստվածության ստուգաթերթ",
    ru: "Чек-лист готовности к проверке трудовой инспекции",
    en: "Labour inspection readiness checklist",
  },
  date: { hy: "Ամսաթիվ", ru: "Дата", en: "Date" },
  cols: {
    hy: ["Հարց", "Աշխատող", "Ժամկետ", "Տեսակ", "Հիմք"],
    ru: ["Замечание", "Сотрудник", "Срок", "Тип", "Основание"],
    en: ["Issue", "Employee", "Due", "Type", "Basis"],
  },
  generated: { hy: "Ստեղծված է Tesuch-ով", ru: "Создано в Tesuch", en: "Generated by Tesuch" },
} as const;

/** General preparation list printed on the "inspector is here" pack. No article numbers: it is not legal advice. */
export const PACK_DOCS = {
  title: { hy: "Պատրաստ պահելու փաստաթղթեր", ru: "Документы, которые нужно подготовить", en: "Documents to have ready" },
  note: {
    hy: "Ընդհանուր ցանկ է և իրավական խորհրդատվություն չէ։ Հարցրեք Ձեր իրավաբանին, թե որ փաստաթղթերն են կիրառելի Ձեր դեպքում։",
    ru: "Это общий список, а не юридическая консультация. Уточните у юриста, какие документы нужны именно вам.",
    en: "This is a general list, not legal advice. Ask your lawyer which documents apply to you.",
  },
  items: {
    hy: [
      "Բոլոր աշխատակիցների աշխատանքային պայմանագրերը (ստորագրված օրինակները)",
      "Աշխատանքի ընդունման, տեղափոխման և ազատման հրամանները",
      "Աշխատանքային ներքին կարգապահական կանոնները և պաշտոնային հրահանգները",
      "Աշխատաժամանակի հաշվառման տեղեկագրերը և աշխատանքային գրաֆիկը",
      "Աշխատավարձի հաշվարկի և վճարման փաստաթղթերը",
      "Արձակուրդների գրաֆիկը, արձակուրդի հրամանները և արձակուրդային օրերի հաշվառումը",
      "Յուրաքանչյուր աշխատակցի գրանցումը պետական եկամուտների կոմիտեում",
      "Աշխատանքի անվտանգության հրահանգավորման մատյանը",
      "Փորձաշրջանի և որոշակի ժամկետով պայմանագրերի հիմքերը հավաստող փաստաթղթերը",
      "Նախորդ ստուգումների ակտերը, եթե եղել են",
    ],
    ru: [
      "Трудовые договоры всех сотрудников (подписанные экземпляры)",
      "Приказы о приёме на работу, переводе и увольнении",
      "Правила внутреннего трудового распорядка и должностные инструкции",
      "Табели учёта рабочего времени и график работы",
      "Документы по расчёту и выплате зарплаты",
      "График отпусков, приказы об отпусках и учёт дней отпуска",
      "Регистрация каждого сотрудника в Комитете государственных доходов",
      "Журнал инструктажа по охране труда",
      "Документы, подтверждающие испытательный срок и основания срочных договоров",
      "Акты предыдущих проверок, если они были",
    ],
    en: [
      "Employment contracts of every employee (signed copies)",
      "Orders on hiring, transfer and dismissal",
      "Internal work rules and job descriptions",
      "Time sheets and the work schedule",
      "Payroll calculation and payment records",
      "Leave schedule, leave orders and leave balances",
      "Each employee's registration with the State Revenue Committee",
      "Occupational safety briefing log",
      "Documents behind probation periods and the grounds for fixed-term contracts",
      "Acts of previous inspections, if any",
    ],
  },
} as const;

export interface ChecklistData {
  locale: Locale;
  /** "Inspector is here" pack: adds a page listing the documents to have ready. */
  pack?: boolean;
  company: CompanyInfo;
  asOf: IsoDate;
  /** null = company has no staff yet; the PDF prints "No data yet" instead of a number. */
  score: number | null;
  items: { finding: Finding; employeeName: string }[];
}

const WIDTHS = ["28%", "17%", "14%", "19%", "22%"];

export function readinessChecklist({ locale, company, asOf, score, items, pack = false }: ChecklistData): DocElement {
  const header = h(
    View,
    { style: s.th, fixed: true },
    h(View, { style: { width: 18 } }),
    ...CL.cols[locale].map((c, i) => h(Text, { key: c, style: { width: WIDTHS[i] } }, c)),
  );
  const rows = items.map(({ finding: f, employeeName }, idx) => {
    const rule = ruleById(f.ruleId);
    return h(
      View,
      { key: `${f.ruleId}-${f.employeeId}-${f.contractId ?? ""}-${idx}`, style: s.tr, wrap: false },
      h(View, { style: s.box }),
      txt({ width: WIDTHS[0], paddingRight: 6 }, rule.title[locale]),
      txt({ width: WIDTHS[1], paddingRight: 6 }, employeeName),
      txt({ width: WIDTHS[2], paddingRight: 4 }, formatDate(f.dueDate) + (f.overdue ? `\n${T.overdue[locale]}` : "")),
      txt({ width: WIDTHS[3], paddingRight: 4 }, SEVERITY_LABEL[locale][f.severity]),
      txt({ width: WIDTHS[4] }, citation(rule, locale)),
    );
  });
  return h(
    Document,
    { title: `${CL.title[locale]} — ${company.name}`, language: locale },
    h(
      Page,
      { size: "A4", style: s.page },
      h(
        View,
        { style: s.content },
        txt(s.title, CL.title[locale]),
        txt(s.subtitle, company.name),
        meta([
          [`${CL.date[locale]}:`, formatDate(asOf)],
          [`${T.score[locale]}:`, score === null ? T.noScore[locale] : `${score}/100`],
          [`${T.openFindings[locale]}:`, String(items.length)],
        ]),
        items.length === 0 ? txt(s.para, T.noFindings[locale]) : h(View, null, header, ...rows),
        txt(s.para, coverageLine(locale)),
      ),
      h(Text, {
        style: s.footerNeutral,
        fixed: true,
        render: ({ pageNumber, totalPages }) => `${DISCLAIMER[locale]} · ${rulesReviewedLine(locale)} · ${CL.generated[locale]} · ${pageNumber}/${totalPages}`,
      }),
    ),
    ...(pack
      ? [
          h(
            Page,
            { key: "pack", size: "A4", style: s.page },
            h(
              View,
              { style: s.content },
              txt(s.title, PACK_DOCS.title[locale]),
              txt(s.subtitle, company.name),
              ...PACK_DOCS.items[locale].map((item) =>
                h(View, { key: item, style: s.tr, wrap: false }, h(View, { style: s.box }), txt({ flex: 1, fontSize: 11 }, item)),
              ),
              txt(s.basis, PACK_DOCS.note[locale]),
            ),
            h(Text, { style: s.footerNeutral, fixed: true, render: ({ pageNumber, totalPages }) => `${DISCLAIMER[locale]} · ${rulesReviewedLine(locale)} · ${CL.generated[locale]} · ${pageNumber}/${totalPages}` }),
          ),
        ]
      : []),
  );
}
