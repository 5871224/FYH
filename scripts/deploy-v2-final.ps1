$ErrorActionPreference = "Stop"

$functions = @(
  "attendance-clock",
  "attendance-clock-safe",
  "meal-order",
  "attendance-overtime-employee",
  "attendance-overtime-admin-list",
  "attendance-overtime-admin-action",
  "attendance-admin-list-v2",
  "attendance-admin-action-v2",
  "department-attendance-v2",
  "member-delete-v2",
  "personal-records-v2",
  "meal-report-v2",
  "meal-cancel-v2"
)

Write-Host "福圓號 V2 Edge Functions 部署" -ForegroundColor Cyan
Write-Host "此腳本不會執行 SQL。請先完成 supabase/V2_SQL_ORDER_FINAL.md。" -ForegroundColor Yellow

foreach ($functionName in $functions) {
  Write-Host "`nDeploying $functionName ..." -ForegroundColor Cyan
  & npx supabase@latest functions deploy $functionName --use-api
  if ($LASTEXITCODE -ne 0) {
    throw "部署失敗：$functionName"
  }
}

Write-Host "`n全部 V2 Edge Functions 部署完成。" -ForegroundColor Green
