$ErrorActionPreference = "Stop"

$functions = @(
  "attendance-clock",
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

Write-Host "Deploying V2 Edge Functions..." -ForegroundColor Cyan
Write-Host "This script does not apply SQL migrations." -ForegroundColor Yellow
Write-Host "Apply supabase/027 through supabase/032 in SQL Editor first." -ForegroundColor Yellow

foreach ($functionName in $functions) {
  Write-Host "`nDeploying $functionName" -ForegroundColor Cyan
  & npx supabase@latest functions deploy $functionName --use-api
  if ($LASTEXITCODE -ne 0) {
    throw "Deployment failed: $functionName"
  }
}

Write-Host "`nV2 Edge Functions deployed successfully." -ForegroundColor Green
