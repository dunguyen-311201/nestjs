#!/usr/bin/env bash
# PostToolUse hook: after Edit/Write touches queries.sql or init-db.sql, run it
# through the local Postgres container so syntax/schema errors surface
# immediately instead of waiting for someone to run it by hand.
set -euo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

case "$(basename -- "$file_path" 2>/dev/null || true)" in
  queries.sql|init-db.sql) ;;
  *) exit 0 ;;
esac

if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx shipping_postgres; then
  echo "validate-sql hook: shipping_postgres container not running, skipping validation of $file_path" >&2
  exit 0
fi

case "$(basename -- "$file_path")" in
  queries.sql)
    # Read-only analytical queries: safe to run directly against the live DB.
    output=$(docker exec -i shipping_postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < "$file_path" 2>&1) && status=0 || status=$?
    ;;
  init-db.sql)
    # Schema DDL: apply against a disposable database so this never touches
    # live seeded data, and so CREATE TABLE IF NOT EXISTS can't mask a change
    # that would fail against a genuinely fresh volume.
    tmp_db="init_db_check_$$"
    docker exec -i shipping_postgres psql -U postgres -d postgres -c "CREATE DATABASE ${tmp_db};" >/dev/null 2>&1
    output=$(docker exec -i shipping_postgres psql -U postgres -d "${tmp_db}" -v ON_ERROR_STOP=1 -f - < "$file_path" 2>&1) && status=0 || status=$?
    docker exec -i shipping_postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS ${tmp_db};" >/dev/null 2>&1
    ;;
esac

if [ "$status" -ne 0 ]; then
  echo "validate-sql hook: $file_path failed against shipping_postgres:" >&2
  echo "$output" | grep -i "ERROR" >&2
  exit 2
fi

exit 0
