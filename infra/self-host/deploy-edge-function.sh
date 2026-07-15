#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FUNCTION_NAME="member-auth-admin"

if ! command -v supabase >/dev/null 2>&1; then
  echo "請先安裝 Supabase CLI：https://supabase.com/docs/guides/cli"
  exit 1
fi

cd "${ROOT_DIR}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "提示：自架環境若未使用 Supabase Cloud，請改用 CLI link 後部署。"
fi

supabase functions deploy "${FUNCTION_NAME}" --no-verify-jwt=false

echo "Deployed ${FUNCTION_NAME}"
