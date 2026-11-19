#!/usr/bin/env bash
# Applies the shim + all migrations to a throwaway Postgres, then runs docs/qa/breaker/db.sql.
# Usage: runuser -u postgres -- bash docs/qa/breaker/db-run.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$(mktemp -d)"; PORT="${PGPORT_TEST:-54339}"
trap '"$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"' EXIT
"$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA" -l "$DATA/log" -w start >/dev/null
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -tA -f "$ROOT/docs/qa/breaker/db.sql" 2>&1 | sed "s/^psql:[^ ]* NOTICE:  //" | grep -E "BROKE|HELD"
