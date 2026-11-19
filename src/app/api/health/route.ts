import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import pkg from "../../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 2000;
// One real database round trip per this many ms at most, so the endpoint cannot be used to load the database.
const DB_CACHE_MS = 10_000;

type DbStatus = { ok: boolean; latencyMs: number | null };
let cached: { at: number; value: DbStatus } | null = null;

/** HEAD request on public.rules (no rows, no count returned): proves PostgREST + Postgres answer. */
async function checkDb(): Promise<DbStatus | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // not configured: report the app as up, the DB as unknown
  if (cached && Date.now() - cached.at < DB_CACHE_MS) return cached.value;

  const started = performance.now();
  let ok = false;
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await db.from("rules").select("id", { head: true }).limit(1).abortSignal(AbortSignal.timeout(DB_TIMEOUT_MS));
    ok = !error;
  } catch {
    ok = false;
  }
  const value = { ok, latencyMs: Math.round(performance.now() - started) };
  cached = { at: Date.now(), value };
  return value;
}

/**
 * Liveness + database reachability for uptime monitors. Public, so it returns only booleans, a version and
 * a timestamp: never error messages, hostnames or environment values. 503 when the database is unreachable.
 */
export async function GET() {
  const db = await checkDb();
  const ok = db?.ok ?? true;
  const body = {
    ok,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? pkg.version,
    time: new Date().toISOString(),
    db: db ?? { ok: null, latencyMs: null },
  };
  return NextResponse.json(body, { status: ok ? 200 : 503, headers: { "cache-control": "no-store, max-age=0" } });
}
