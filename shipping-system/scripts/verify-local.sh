#!/usr/bin/env bash
# Local "CI" for this project: no NestJS code exists yet (docs + SQL only),
# so there's nothing to build/lint/test. This instead exercises the actual
# docker-compose stack: bring it up, reseed deterministically (seed.sql
# TRUNCATEs first, so this is safe to rerun), then run queries.sql end to
# end and fail loudly on the first SQL error. Run this before committing
# changes to init-db.sql/seed.sql/queries.sql.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> docker compose up -d"
docker compose up -d

echo "==> waiting for postgres to be ready"
for _ in $(seq 1 30); do
  if docker exec shipping_postgres pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! docker exec shipping_postgres pg_isready -U postgres >/dev/null 2>&1; then
  echo "postgres did not become ready in time" >&2
  exit 1
fi

echo "==> seeding (seed.sql TRUNCATEs first, safe to rerun)"
docker exec -i shipping_postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < seed.sql >/dev/null

echo "==> running queries.sql"
if ! docker exec -i shipping_postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < queries.sql > /tmp/verify-local-queries.out 2>&1; then
  echo "queries.sql FAILED:" >&2
  grep -i "ERROR" /tmp/verify-local-queries.out >&2 || true
  exit 1
fi

echo "==> OK — stack is up, seeded, and queries.sql runs clean"
echo "    full query output: /tmp/verify-local-queries.out"
