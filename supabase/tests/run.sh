#!/usr/bin/env bash
# Runs migrations + RLS tests against a throwaway local Postgres. Usage: supabase/tests/run.sh
set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$(mktemp -d)"; PORT="${PGPORT_TEST:-54329}"
trap '"$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"' EXIT
"$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA" -l "$DATA/log" -w start >/dev/null
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/tests/rls_cross_tenant.sql" 2>&1 | sed "s/^psql:[^ ]* NOTICE:  //"

# Lane tests (each file is self-contained)
for t in "$ROOT"/supabase/tests/lane_*.sql; do
  [ -e "$t" ] && "${PSQL[@]}" -o /dev/null -f "$t" 2>&1 | sed "s/^psql:[^ ]* NOTICE:  //"
done

# Demo seed must keep applying cleanly to the current schema.
"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/seed/demo.sql"
"${PSQL[@]}" -tA -c "select 'demo seed: ' || (select count(*) from public.employees) || ' employees total after seed'"
