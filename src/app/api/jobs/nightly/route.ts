import { timingSafeEqual } from "node:crypto";
import { format, isMonday } from "date-fns";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { ensureRules, runRulesForCompany } from "@/lib/jobs/run";
import { deliverDigest } from "@/lib/notify/deliver";
import type { Locale } from "@/lib/notify/i18n";
import type { DigestCompany } from "@/lib/notify/messages";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request, secret: string): boolean {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Nightly rule run. Called by Vercel Cron (see vercel.json). Sends alerts for new/reopened findings and the Monday digest. */
export async function GET(req: Request) {
  const env = serverEnv();
  if (!authorized(req, env.CRON_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = supabaseService();
  const asOf = format(new Date(), "yyyy-MM-dd");
  try {
    await ensureRules(db);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const { data: companies, error } = await db.from("companies").select("id, org_id, name, orgs(locale)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = { companies: 0, inserted: 0, updated: 0, reopened: 0, autoResolved: 0, alertsSent: 0, digestsSent: 0, failed: [] as string[] };
  const monday = isMonday(new Date(`${asOf}T12:00:00Z`));
  const digests = new Map<string, { locale: Locale; companies: DigestCompany[] }>();

  for (const co of companies ?? []) {
    try {
      const locale = ((co.orgs as unknown as { locale?: string } | null)?.locale ?? "hy") as Locale;
      const r = await runRulesForCompany(db, { id: co.id, org_id: co.org_id, name: co.name, locale }, asOf, { sendAlerts: true });
      if (monday && r.computed.length) {
        const d = digests.get(co.org_id) ?? { locale, companies: [] };
        d.companies.push({ companyName: co.name, score: r.score, items: r.items });
        digests.set(co.org_id, d);
      }
      summary.companies++;
      summary.inserted += r.inserted;
      summary.updated += r.updated;
      summary.reopened += r.reopened;
      summary.autoResolved += r.autoResolved;
      summary.alertsSent += r.alertsSent;
    } catch (e) {
      // One broken company must not stop the run for everyone else.
      summary.failed.push(`${co.id}: ${(e as Error).message}`);
    }
  }

  for (const [orgId, d] of digests) {
    try {
      summary.digestsSent += await deliverDigest(db, orgId, d.locale, d.companies);
    } catch (e) {
      summary.failed.push(`digest ${orgId}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ asOf, ...summary }, { status: summary.failed.length ? 207 : 200 });
}
