#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "用法: $0 <backup.dump>"
  exit 1
fi

DUMP_FILE="$1"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "請設定 DATABASE_URL（內網 Postgres）"
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "找不到 pg_restore"
  exit 1
fi

if [[ ! -f "${DUMP_FILE}" ]]; then
  echo "找不到 dump：${DUMP_FILE}"
  exit 1
fi

echo "Restoring ${DUMP_FILE} to ${DATABASE_URL}"
pg_restore \
  --dbname="${DATABASE_URL}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "${DUMP_FILE}"

echo "Restore complete. Run verify-counts.sql to validate."
