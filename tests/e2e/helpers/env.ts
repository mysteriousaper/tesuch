import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Loads .env.local into process.env (without overriding) so tests use the same Supabase project as the app. Never logs values. */
export function loadEnv(): void {
  let text = "";
  try {
    text = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export function requireEnv(name: string): string {
  loadEnv();
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name} (expected in .env.local)`);
  return v;
}

export const hasSupabase = (): boolean => {
  loadEnv();
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
};
