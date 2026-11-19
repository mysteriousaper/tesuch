/** PostgREST returns at most 1000 rows per request. Read every page of a query until a short page comes back. */
export const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** `fetchPage(from, to)` must run the same query with `.order(<unique column>).range(from, to)`. */
export async function readAll<T>(fetchPage: (from: number, to: number) => Page<T>, pageSize = PAGE_SIZE): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
