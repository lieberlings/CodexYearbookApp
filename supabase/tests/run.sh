#!/usr/bin/env bash
# Runs the migration and its access-rule tests against a throwaway local
# Postgres (16+). Needs the Postgres server binaries on PATH or in
# /usr/lib/postgresql/<version>/bin.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | sort -V | tail -1)")"
tmp="$(mktemp -d)"
run_as=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$tmp"
  run_as=(runuser -u postgres --)
fi
cleanup() { "${run_as[@]}" "$bin/pg_ctl" -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
"${run_as[@]}" "$bin/initdb" -D "$tmp/data" -U postgres --auth=trust >/dev/null
"${run_as[@]}" "$bin/pg_ctl" -D "$tmp/data" -o "-k $tmp -c listen_addresses=''" -w start >/dev/null
psql_run() { "${run_as[@]}" "$bin/psql" -h "$tmp" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -t -A "$@" | { grep -v "^$" || true; }; }
psql_run -f "$here/stubs.sql"
for migration in "$here"/../migrations/*.sql; do
  psql_run -f "$migration"
done
psql_run -f "$here/helpers.sql"
psql_run -f "$here/access_rules.sql"
