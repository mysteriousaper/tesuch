export interface ContractRow {
  id: string;
  type: "indefinite" | "fixed_term";
  start_date: string;
  end_date: string | null;
  probation_end: string | null;
  terminated_on: string | null;
}

interface Labels {
  heading: string;
  probationConfirm: string;
  probationTerminate: string;
  fixedTermEnd: string;
  dismissal: string;
  noticeDate: string;
  download: string;
}

const link = "inline-flex items-center gap-1 rounded-theme border border-control px-3 py-2 text-sm hover:bg-surface-2";

/** Only the documents that apply to this contract: probation orders need a probation end, the end notice a fixed term. */
export function ContractDocs({ contract: c, today, labels }: { contract: ContractRow; today: string; labels: Labels }) {
  const pdf = (path: string) => `/api/pdf/${path}`;
  return (
    <li className="flex flex-col gap-2 border-t border-line pt-3 first:border-0 first:pt-0">
      <p className="text-sm text-muted">{labels.heading}</p>
      <div className="flex flex-wrap gap-2">
        {c.probation_end && (
          <>
            <a className={link} download href={pdf(`probation?contract=${c.id}&decision=confirm`)}>⬇ {labels.probationConfirm}</a>
            <a className={link} download href={pdf(`probation?contract=${c.id}&decision=terminate`)}>⬇ {labels.probationTerminate}</a>
          </>
        )}
        {c.type === "fixed_term" && c.end_date && (
          <a className={link} download href={pdf(`fixed-term-end?contract=${c.id}`)}>⬇ {labels.fixedTermEnd}</a>
        )}
      </div>
      <form method="get" action={pdf("dismissal")} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="contract" value={c.id} />
        <label className="flex flex-col gap-1 text-xs text-muted">
          {labels.noticeDate}
          <input type="date" name="date" defaultValue={today} required className="rounded-theme border border-control bg-surface px-2 py-1.5 text-sm text-ink" />
        </label>
        <button className={link}>⬇ {labels.dismissal}</button>
      </form>
    </li>
  );
}
