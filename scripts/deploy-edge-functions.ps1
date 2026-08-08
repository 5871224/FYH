$ErrorActionPreference = "Stop"

$functions = @(
  "member-auth-admin",
  "attendance-clock",
  "attendance-ledger",
  "attendance-ledger-export",
  "attendance-review-groups",
  "meal-order",
  "meal-report-v2",
  "meal-cancel-v2"
)

Write-Host "FYH Edge Functions deployment" -ForegroundColor Cyan
Write-Host "This script does not run SQL migrations." -ForegroundColor Yellow
Write-Host "Complete the SQL files in this order before deployment:" -ForegroundColor Yellow
Write-Host "1. supabase/001_current_schema.sql" -ForegroundColor Yellow
Write-Host "2. supabase/002_current_updates.sql" -ForegroundColor Yellow

foreach ($functionName in $functions) {
  Write-Host ""
  Write-Host "Deploying $functionName ..." -ForegroundColor Cyan
  & npx.cmd supabase@latest functions deploy $functionName --use-api
  if ($LASTEXITCODE -ne 0) {
    throw "Deployment failed: $functionName"
  }
}

Write-Host ""
Write-Host "All Edge Functions deployed successfully." -ForegroundColor Green
