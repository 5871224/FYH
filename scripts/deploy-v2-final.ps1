$ErrorActionPreference = "Stop"

$functions = @(
  "member-auth-admin",
  "catalog-admin",
  "report-records",
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
  "member-order-v2",
  "personal-records-v2",
  "meal-report-v2",
  "meal-cancel-v2"
)

Write-Host "FYH V2 Edge Functions deployment" -ForegroundColor Cyan
Write-Host "This script does not run SQL migrations." -ForegroundColor Yellow
Write-Host "Complete supabase/V2_SQL_ORDER_FINAL.md before deployment." -ForegroundColor Yellow

foreach ($functionName in $functions) {
  Write-Host ""
  Write-Host "Deploying $functionName ..." -ForegroundColor Cyan
  & npx.cmd supabase@latest functions deploy $functionName --use-api
  if ($LASTEXITCODE -ne 0) {
    throw "Deployment failed: $functionName"
  }
}

Write-Host ""
Write-Host "All V2 Edge Functions deployed successfully." -ForegroundColor Green
