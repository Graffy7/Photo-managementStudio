<#
  Studio OS - deploys the checked-out code to this Windows server (run by the GitHub runner on the VPS,
  or by hand from the repository root:  powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1).

  Steps: build -> back up the database -> keep the running version -> install the new one
         -> health check -> put the previous version back if the check fails.

  Stored files (photo previews, logos, signatures) live in their own storage folder
  (Storage__Local__RootPath, outside these folders) and are never touched; an older layout that
  still keeps them in api\wwwroot\uploads is protected too.
  Secrets are NOT here: the API reads them from the server's environment variables
  (see deploy\SERVER-SETUP.md).

  Settings (environment variables, defaults in brackets):
    STUDIOOS_ROOT        [C:\StudioOS]     folders api, web, releases, backups live under it
    STUDIOOS_API_URL     (required)        public API address, e.g. https://api.example.com
    STUDIOOS_SQL_SERVER  [localhost\SQLEXPRESS]
    STUDIOOS_DB_NAME     [StudioManagementDb]
    STUDIOOS_BACKUP_DIR  [<root>\backups] SQL Server must be able to write here
    STUDIOOS_SKIP_DB_BACKUP  set to 1 to skip the backup (not recommended)
#>
$ErrorActionPreference = "Stop"

$root      = if ($env:STUDIOOS_ROOT) { $env:STUDIOOS_ROOT } else { "C:\StudioOS" }
$apiUrl    = $env:STUDIOOS_API_URL
$sqlServer = if ($env:STUDIOOS_SQL_SERVER) { $env:STUDIOOS_SQL_SERVER } else { "localhost\SQLEXPRESS" }
$dbName    = if ($env:STUDIOOS_DB_NAME) { $env:STUDIOOS_DB_NAME } else { "StudioManagementDb" }
if (-not $apiUrl) { throw "STUDIOOS_API_URL is not set (the public API address, e.g. https://api.example.com)." }
$apiUrl = $apiUrl.TrimEnd("/")

$repo     = Split-Path -Parent $PSScriptRoot
$stamp    = Get-Date -Format "yyyyMMdd-HHmmss"
$apiDir   = Join-Path $root "api"
$webDir   = Join-Path $root "web"
$stage    = Join-Path $root "releases\incoming"
$previous = Join-Path $root "releases\previous"
# SQL Server itself writes the backup file, so its service account needs write access to this folder.
$backups  = if ($env:STUDIOOS_BACKUP_DIR) { $env:STUDIOOS_BACKUP_DIR } else { Join-Path $root "backups" }
New-Item -ItemType Directory -Force $apiDir, $webDir, $backups, (Join-Path $root "releases") | Out-Null

function Step($text) { Write-Host "`n=== $text" }

# robocopy exit codes 0-7 mean success (files copied / nothing to do); 8 and up are failures.
# Folders/files named in $skipDirs / $skipFiles are neither copied nor deleted on either side.
function Mirror($from, $to, [string[]]$skipDirs = @(), [string[]]$skipFiles = @()) {
  $rc = @($from, $to, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:3", "/W:2")
  if ($skipDirs.Count -gt 0) { $rc += "/XD"; $rc += $skipDirs }
  if ($skipFiles.Count -gt 0) { $rc += "/XF"; $rc += $skipFiles }
  & robocopy @rc | Out-Host
  if ($LASTEXITCODE -ge 8) { throw "Copy from $from to $to failed (robocopy $LASTEXITCODE)." }
  $global:LASTEXITCODE = 0
}

function Healthy {
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri "$apiUrl/health" -TimeoutSec 10
      if ($r.StatusCode -eq 200 -and $r.Content -match "Healthy") { return $true }
    } catch { }
    Start-Sleep -Seconds 3
  }
  return $false
}

# The API folder is live: app_offline.htm makes IIS stop the app (releasing its files) and show a
# short "updating" page; removing it starts the app again.
$offline = Join-Path $apiDir "app_offline.htm"
function Stop-Api { Set-Content -Path $offline -Encoding UTF8 -Value "<!doctype html><title>Updating</title><p style='font-family:sans-serif'>Studio OS is updating. Please refresh in a minute.</p>"; Start-Sleep -Seconds 5 }
function Start-Api { if (Test-Path $offline) { Remove-Item $offline -Force } }

# Uploads and logs stay where they are, in every copy direction.
$keep = @("uploads", "logs", "Logs")
$notCopied = @("app_offline.htm")

# ---------------------------------------------------------------------------------------- build
Step "Building the API"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
dotnet publish (Join-Path $repo "backend\StudioManagement.API\StudioManagement.API.csproj") -c Release -o (Join-Path $stage "api") --nologo
if ($LASTEXITCODE -ne 0) { throw "API build failed." }

Step "Building the website (API address: $apiUrl)"
Push-Location (Join-Path $repo "frontend")
try {
  npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
  $env:EXPO_PUBLIC_API_BASE_URL = $apiUrl
  npx expo export --platform web --output-dir (Join-Path $stage "web")
  if ($LASTEXITCODE -ne 0) { throw "Website build failed." }
} finally { Pop-Location }
Copy-Item (Join-Path $PSScriptRoot "web.config") (Join-Path $stage "web\web.config") -Force

# ---------------------------------------------------------------------------------------- backup
if ($env:STUDIOOS_SKIP_DB_BACKUP -ne "1") {
  Step "Backing up the database"
  $bak = Join-Path $backups "$dbName-before-deploy-$stamp.bak"
  sqlcmd -S $sqlServer -E -b -Q "BACKUP DATABASE [$dbName] TO DISK = N'$bak' WITH COPY_ONLY, INIT, COMPRESSION" 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) {
    # Express editions can't compress; try again without it.
    sqlcmd -S $sqlServer -E -b -Q "BACKUP DATABASE [$dbName] TO DISK = N'$bak' WITH COPY_ONLY, INIT" 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Database backup failed - nothing was changed." }
  }
  # Keep the newest 10 deploy backups.
  Get-ChildItem $backups -Filter "$dbName-before-deploy-*.bak" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 10 | Remove-Item -Force
}

# ---------------------------------------------------------------------------------------- install
Step "Keeping the current version (for rollback)"
New-Item -ItemType Directory -Force (Join-Path $previous "api"), (Join-Path $previous "web") | Out-Null
Mirror $apiDir (Join-Path $previous "api") $keep $notCopied
Mirror $webDir (Join-Path $previous "web")

Step "Installing the new version"
Stop-Api
try {
  Mirror (Join-Path $stage "api") $apiDir $keep $notCopied
  Mirror (Join-Path $stage "web") $webDir
} finally {
  Start-Api
}

Step "Checking $apiUrl/health"
if (Healthy) {
  Write-Host "`nDeployed successfully ($stamp)."
  Remove-Item $stage -Recurse -Force
  exit 0
}

# ---------------------------------------------------------------------------------------- rollback
Write-Host "`nThe new version did not start. Putting the previous version back..."
Stop-Api
try {
  Mirror (Join-Path $previous "api") $apiDir $keep $notCopied
  Mirror (Join-Path $previous "web") $webDir
} finally {
  Start-Api
}
if (Healthy) {
  Write-Host "Previous version is running again. The database backup from before this deploy is in $backups."
} else {
  Write-Host "WARNING: the previous version is not answering either. Check the API logs and the database backup in $backups."
}
exit 1
