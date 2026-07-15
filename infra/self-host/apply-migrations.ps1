$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$SqlDir = Join-Path $RootDir "supabase"

if (-not $env:DATABASE_URL) {
  Write-Error "請設定 DATABASE_URL，例如：`n  `$env:DATABASE_URL = 'postgresql://postgres:password@127.0.0.1:5432/postgres'"
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Error "找不到 psql，請先安裝 PostgreSQL client"
}

$Files = Get-ChildItem -Path $SqlDir -Filter "*.sql" -File | Sort-Object Name
if ($Files.Count -eq 0) {
  Write-Error "找不到 SQL migration"
}

Write-Host "Applying $($Files.Count) migrations to $($env:DATABASE_URL)"

foreach ($file in $Files) {
  Write-Host "==> $($file.Name)"
  & psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $file.FullName
  if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
  }
}

Write-Host "All migrations applied."
