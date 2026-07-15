#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/infra/migrate/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT="${BACKUP_DIR}/workforce-${STAMP}.dump"
SCHEMA_ONLY=false

for arg in "$@"; do
  if [[ "${arg}" == "--schema-only" ]]; then
    SCHEMA_ONLY=true
  fi
done

if [[ -z "${CLOUD_DATABASE_URL:-}" ]]; then
  echo "請設定 CLOUD_DATABASE_URL"
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "找不到 pg_dump"
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

ARGS=(
  --format=custom
  --no-owner
  --no-privileges
  --file="${OUTPUT}"
)

if [[ "${SCHEMA_ONLY}" == "true" ]]; then
  ARGS+=(--schema-only)
else
  ARGS+=(--data-only=false)
fi

echo "Exporting to ${OUTPUT}"
pg_dump "${CLOUD_DATABASE_URL}" "${ARGS[@]}"
echo "Done."
