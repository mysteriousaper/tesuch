# Runbook

Supabase project ref: `fbzzhtfakcwnwfuxrqsi`. Never paste keys into chat, tickets or commits.

## Apply database migrations
Files in `supabase/migrations/` are applied in filename order, each once.

**A. SQL editor (simplest).** Supabase dashboard → SQL Editor → paste the new migration file → Run.

**B. Management API** (needs a personal access token from Supabase → Account → Access Tokens):
```bash
export SUPABASE_ACCESS_TOKEN=...   # sbp_...
jq -Rs '{query: .}' supabase/migrations/<file>.sql |
  curl -sS -X POST "https://api.supabase.com/v1/projects/fbzzhtfakcwnwfuxrqsi/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @-
```
Run `pnpm test:db` first: it applies all migrations to a throwaway Postgres and checks RLS. Migrations must be additive and re-runnable by hand when possible. Verify afterwards with `GET /api/health` (`db.ok` true).

## Rotate secrets
After each rotation redeploy (Vercel env changes apply only to new deployments) and check `/api/health`.

| Secret | Steps |
|---|---|
| Supabase service key | Dashboard → Project Settings → API Keys → roll the `service_role` / secret key. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel (Production + Preview) and the GitHub secret of the same name for CI. The old key stops working once rolled. |
| `CRON_SECRET` | `openssl rand -hex 32` → set in Vercel → redeploy. Vercel Cron picks it up automatically. Update any manual-run scripts. |
| `TELEGRAM_WEBHOOK_SECRET` | New value (`openssl rand -hex 32`) → set in Vercel → redeploy → **re-register the webhook** (below), otherwise Telegram keeps sending the old header and the bot is rejected with 401. |
| Resend | Resend dashboard → API Keys → create a new key, set `RESEND_API_KEY` in Vercel, redeploy, then delete the old key. |
| Telegram bot token | @BotFather → `/revoke`, set `TELEGRAM_BOT_TOKEN`, redeploy, re-register the webhook. |

## Re-register the Telegram webhook
```bash
curl -sS "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  --data-urlencode "url=https://<production-domain>/api/telegram/webhook" \
  --data-urlencode "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
  --data-urlencode "allowed_updates=[\"message\"]"
curl -sS "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"   # check url, last_error_message
```

## Run the nightly job manually
```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" https://<production-domain>/api/jobs/nightly
```
401 means a wrong secret. The job is idempotent (findings are upserted), so re-running is safe. Vercel dashboard → Project → Cron Jobs → Run also works. Hobby cron runs once a day, with imprecise timing.

## Backups
**Weekly manual export (stop-gap until Supabase Pro).** Every week, and before any risky migration or bulk change, run on a computer you trust:
```bash
pnpm backup:export        # reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
```
It writes `backups/tesuch-backup-YYYY-MM-DD.json` (every table, all rows, file mode 600; the folder is git-ignored) and exits with code 2 if any table failed. The file holds personal data: keep it on an encrypted disk, copy it to a second safe place, never commit, email or paste it. Delete copies older than 8 weeks. If a table is added in a migration, it is picked up automatically (and add it to `KNOWN_TABLES` in `scripts/backup-export.ts`). Restoring is manual: re-insert the rows in the order orgs, companies, employees, contracts, leave_records, findings. Move to Supabase Pro daily backups before real customer data (docs/RISKS.md R3).

The Supabase **Free tier has no point-in-time recovery** and only limited backups. Before any risky migration or bulk data change export what matters (Dashboard → Database → Backups, or `pg_dump` with the connection string from Project Settings → Database). To recover from a bad change you restore from that export; plan it before you need it.

## Incident checklist
1. **Confirm**: open `/api/health`. `ok: false` or 503 means the database is unreachable; check status.supabase.com and the Supabase dashboard (paused project? Free projects pause after inactivity).
2. **Scope**: Vercel → Deployments → Logs (filter by errors). Users see an error code (digest); search for it in the logs. No stack traces are shown to users by design.
3. **Mitigate**: bad deploy → Vercel → Deployments → promote the previous deployment (instant rollback). Bad migration → fix forward with a new migration, or restore from a backup.
4. **Secret leaked**: rotate it now (table above), redeploy, review logs for misuse. Service key leaks also warrant checking the `alerts_log` and recent data changes.
5. **Alerts not arriving**: run the nightly job manually, check `alerts_log`, Resend dashboard and `getWebhookInfo`.
6. **Communicate**: tell affected users (Telegram/email) what happened and what data, if any, was affected. Note it in `docs/DECISIONS.md`.
7. **Follow up**: add a test that would have caught it.
