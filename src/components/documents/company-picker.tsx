/** Plain GET form: works without JavaScript and keeps the choice in the URL (?company=). */
export function CompanyPicker({
  companies, selected, label, submit,
}: { companies: { id: string; name: string }[]; selected: string; label: string; submit: string }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
        {label}
        <select
          name="company"
          defaultValue={selected}
          className="w-full max-w-xs rounded-full border border-control bg-surface px-3 py-2.5 text-base sm:w-72"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <button className="rounded-full border border-control px-4 py-2.5 text-sm font-medium hover:bg-surface-2">{submit}</button>
    </form>
  );
}
