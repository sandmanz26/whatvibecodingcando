#!/usr/bin/env bash
# Runs the migrations and the row level security tests on a throwaway database.
# Needs a local Postgres; set PGHOST/PGPORT/PGUSER as usual (e.g. PGHOST=/var/tmp/vcpg PGPORT=54329 PGUSER=postgres).
set -euo pipefail
cd "$(dirname "$0")/.."
db="vc_test_$$"
psql -q -c "create database $db" >/dev/null
trap 'psql -q -c "drop database if exists $db" >/dev/null' EXIT
psql -q -d "$db" -v ON_ERROR_STOP=1 -f tests/supabase_stub.sql >/dev/null
for f in migrations/*.sql; do psql -q -d "$db" -v ON_ERROR_STOP=1 -f "$f" >/dev/null; done
for t in tests/*_test.sql; do psql -d "$db" -v ON_ERROR_STOP=1 -f "$t"; done
