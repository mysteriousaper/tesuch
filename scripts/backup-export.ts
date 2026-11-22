// Stop-gap backup until Supabase Pro (daily backups): dumps every table to one dated JSON file on this computer.
//
//   NODE_USE_ENV_PROXY=1 pnpm backup:export        (NODE_USE_ENV_PROXY only where a proxy is needed)
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or the environment.
// The file contains personal data: it goes to backups/ (git-ignored). Keep it on an encrypted disk, never commit or email it.
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local or environment).");
  process.exit(1);
}

/** Tables of the public schema, kept in step with supabase/migrations. Discovery below adds any table missing here. */
const KNOWN_TABLES = [
  "orgs", "memberships", "companies", "employees", "contracts", "leave_records", "rules", "findings", "templates",
  "alerts_log", "audit_log", "consent_records", "invitations", "leads", "quiz_attempts", "telegram_link_tokens", "telegram_links",
];
const PAGE = 1000;
/** Stable paging needs a unique sort key: the primary key. Tables not listed here have a uuid/identity `id`. */
const ORDER_BY: Record<string, string[]> = {
  memberships: ["user_id", "org_id"],
  rules: ["id", "version"],
  telegram_links: ["user_id"],
  telegram_link_tokens: ["token"],
};

const db = createClient(url, key, { auth: { persistSession: false } });

/** Table names PostgREST exposes (OpenAPI document), so a new table is never silently left out of a backup. */
async function discoverTables(): Promise<string[]> {
  const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key!, Authorization: `Bearer ${key}` } });
  if (!res.ok) return [];
  const doc = (await res.json()) as { definitions?: Record<string, unknown> };
  return Object.keys(doc.definitions ?? {});
}

async function dump(table: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db.from(table).select("*");
    for (const col of ORDER_BY[table] ?? ["id"]) query = query.order(col, { ascending: true });
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function main() {
  const tables = [...new Set([...KNOWN_TABLES, ...(await discoverTables())])].sort();
  const out: Record<string, unknown[]> = {};
  const failed: string[] = [];
  for (const t of tables) {
    try {
      out[t] = await dump(t);
      console.log(`${t}: ${out[t].length} rows`);
    } catch (e) {
      failed.push(t);
      console.error(`FAILED ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const stamp = new Date().toISOString().slice(0, 10);
  mkdirSync("backups", { recursive: true });
  const file = `backups/tesuch-backup-${stamp}.json`;
  writeFileSync(file, JSON.stringify({ exported_at: new Date().toISOString(), tables: out }, null, 2), { mode: 0o600 });
  console.log(`Wrote ${file}${failed.length ? ` — INCOMPLETE, failed: ${failed.join(", ")}` : ""}`);
  if (failed.length) process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
