// Target fields an imported column can map to, with header aliases in hy / ru / en.

export const TARGET_FIELDS = [
  "full_name",
  "first_name",
  "last_name",
  "patronymic",
  "birth_date",
  "six_day_week",
  "external_ref",
  "employee_code",
  "contract_type",
  "start_date",
  "end_date",
  "probation_end",
  "probation_special_case",
  "hired_by_transfer",
  "fixed_term_ground",
  "src_registered",
  "terminated_on",
  "termination_ground",
  "termination_initiator",
  "notice_given_on",
  "workforce_reduction",
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number];

export const FIELD_ALIASES: Record<TargetField, string[]> = {
  full_name: [
    "full name", "employee name", "employee", "name",
    "անուն ազգանուն", "ազգանուն անուն", "անուն ազգանուն հայրանուն", "աշխատող", "աշխատողի անուն",
    "фио", "ф и о", "сотрудник", "работник", "фамилия имя отчество", "фамилия имя",
  ],
  first_name: ["first name", "given name", "անուն", "имя"],
  last_name: ["last name", "surname", "family name", "ազգանուն", "фамилия"],
  patronymic: ["middle name", "patronymic", "հայրանուն", "отчество"],
  birth_date: [
    "birth date", "date of birth", "dob", "birthday",
    "ծննդյան ամսաթիվ", "ծննդյան օր", "ծնված",
    "дата рождения", "день рождения",
  ],
  six_day_week: [
    "six day week", "6 day week",
    "վեցօրյա", "վեցօրյա աշխատանքային շաբաթ", "վեցօրյա շաբաթ",
    "шестидневка", "шестидневная неделя", "шестидневная рабочая неделя",
  ],
  external_ref: [
    "employee id", "employee number", "personnel number", "tab number", "id",
    "տաբելային համար", "տաբել համար", "աշխատողի կոդ",
    "табельный номер", "табельный №", "таб номер", "таб №",
  ],
  // Privacy mode only: the code replaces the name. Some aliases overlap external_ref; autoMap prefers this field in privacy mode.
  employee_code: [
    "code", "employee code", "tabel number", "tabel no", "tab no", "tab number",
    "կոդ", "աշխատակցի կոդ", "աշխատողի կոդ",
    "код", "табельный номер", "таб №", "код сотрудника",
  ],
  contract_type: [
    "contract type", "type of contract",
    "պայմանագրի տեսակ", "պայմանագրի տիպ",
    "тип договора", "вид договора",
  ],
  start_date: [
    "start date", "hire date", "hired on", "date hired", "contract start",
    "ընդունման ամսաթիվ", "աշխատանքի ընդունման ամսաթիվ", "պայմանագրի սկիզբ", "սկզբի ամսաթիվ",
    "дата приема", "дата приёма", "дата начала", "дата приема на работу", "начало договора",
  ],
  end_date: [
    "end date", "contract end", "contract end date",
    "պայմանագրի ավարտ", "ավարտի ամսաթիվ", "պայմանագրի ավարտի ամսաթիվ",
    "дата окончания", "окончание договора", "дата окончания договора",
  ],
  probation_end: [
    "probation end", "end of probation", "probation end date", "probation",
    "փորձաշրջանի ավարտ", "փորձաշրջանի ավարտի ամսաթիվ", "փորձաշրջան",
    "окончание испытательного срока", "окончания испытательного срока", "конец испытательного срока", "испытательный срок",
  ],
  probation_special_case: [
    "probation special case", "extended probation",
    "փորձաշրջանի բացառիկ դեպք", "երկարաձգված փորձաշրջան",
    "особый испытательный срок", "продленный испытательный срок",
  ],
  hired_by_transfer: [
    "hired by transfer", "transfer",
    "փոխադրմամբ", "փոխադրմամբ ընդունված",
    "переводом", "в порядке перевода", "принят переводом",
  ],
  fixed_term_ground: [
    "fixed term ground", "fixed term reason", "ground for fixed term",
    "ժամկետի հիմք", "որոշակի ժամկետի հիմք", "ժամկետային պայմանագրի հիմք",
    "основание срочного договора", "основание срочности",
  ],
  src_registered: [
    "src registered", "registered with src", "src",
    "պեկ ում գրանցված", "գրանցված պեկ ում", "պեկ գրանցում",
    "зарегистрирован в кгд", "регистрация кгд", "кгд",
  ],
  terminated_on: [
    "termination date", "dismissal date", "terminated on", "date of termination",
    "ազատման ամսաթիվ", "աշխատանքից ազատման ամսաթիվ", "պայմանագրի լուծման ամսաթիվ",
    "дата увольнения", "дата расторжения",
  ],
  termination_ground: [
    "termination ground", "termination reason", "dismissal reason",
    "ազատման հիմք", "լուծման հիմք", "աշխատանքից ազատման հիմք",
    "основание увольнения", "причина увольнения", "основание расторжения",
  ],
  termination_initiator: [
    "termination initiator", "initiated by", "initiator",
    "նախաձեռնող", "ազատման նախաձեռնող",
    "инициатор увольнения", "инициатор",
  ],
  notice_given_on: [
    "notice date", "notice given on", "date of notice",
    "ծանուցման ամսաթիվ", "ծանուցման օր",
    "дата уведомления", "дата предупреждения",
  ],
  workforce_reduction: [
    "workforce reduction", "redundancy", "layoff",
    "կրճատում", "հաստիքների կրճատում",
    "сокращение", "сокращение штата", "сокращение численности",
  ],
};

/** Lowercase, Unicode-normalise, and collapse punctuation/whitespace so "Дата приёма:" ≈ "дата приёма". */
export function normalizeHeader(s: string): string {
  return s
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[«»"'`’.,:;()\[\]{}_\-–—/\\#№*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fields that carry a person's name. In privacy mode they are never read or stored. */
export const NAME_FIELDS: readonly TargetField[] = ["full_name", "first_name", "last_name", "patronymic"];

/** Fields offered in the column picker: the code in privacy mode, names otherwise (never both). */
export function selectableFields(privacy: boolean): TargetField[] {
  return TARGET_FIELDS.filter((f) => (privacy ? !NAME_FIELDS.includes(f) : f !== "employee_code"));
}
