#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SQL_DIR="${ROOT_DIR}/supabase"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "請設定 DATABASE_URL，例如："
  echo "  export DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/postgres"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "找不到 psql，請先安裝 PostgreSQL client"
  exit 1
fi

mapfile -t FILES < <(find "${SQL_DIR}" -maxdepth 1 -type f -name '*.sql' | sort)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "找不到 SQL migration"
  exit 1
fi

echo "Applying ${#FILES[@]} migrations to ${DATABASE_URL}"

for file in "${FILES[@]}"; do
  echo "==> $(basename "${file}")"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${file}"
done

echo "All migrations applied."
