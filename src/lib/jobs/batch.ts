/** Pure helpers to keep PostgREST requests small: URL length limits and the nightly 60 s budget. */

export const ID_CHUNK = 200;
export const INSERT_CHUNK = 500;
export const POOL = 4;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error("chunk size must be a positive integer");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface PatchGroup<P> {
  patch: P;
  ids: string[];
}

/** Group rows by identical patch payload (the id is excluded). First-seen order is kept. */
export function groupByPatch<P extends object, R extends { id: string }>(
  rows: readonly R[],
  toPatch: (row: R) => P,
): PatchGroup<P>[] {
  const groups = new Map<string, PatchGroup<P>>();
  for (const row of rows) {
    const patch = toPatch(row);
    const k = JSON.stringify(Object.entries(patch).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    const g = groups.get(k);
    if (g) g.ids.push(row.id);
    else groups.set(k, { patch, ids: [row.id] });
  }
  return [...groups.values()];
}

/** One (patch, id-chunk) job per request: each group split into chunks of `size` ids. */
export function patchJobs<P>(groups: readonly PatchGroup<P>[], size = ID_CHUNK): { patch: P; ids: string[] }[] {
  return groups.flatMap((g) => chunk(g.ids, size).map((ids) => ({ patch: g.patch, ids })));
}

/** Run async tasks with bounded concurrency; rejects with the first error (no new tasks start after it). Results keep input order. */
export async function runPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i]);
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
