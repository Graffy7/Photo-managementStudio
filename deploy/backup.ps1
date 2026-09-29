<#
  Studio OS - backs up the two things that hold your data, separately:
    1. the SQL Server database  -> <destination>\database\StudioManagementDb-<date>.bak
    2. the photo storage folder -> <destination>\storage\   (an exact copy, updated each run)
  The application code needs no backup: it is in GitHub.

  Run on the server (PowerShell as Administrator):
    powershell -ExecutionPolicy Bypass -File deploy\backup.ps1 -Destination E:\StudioOS-backup

  Settings (environment variables, defaults in brackets):
    STUDIOOS_SQL_SERVER    [localhost\SQLEXPRESS]
    STUDIOOS_DB_NAME       [StudioManagementDb]
    Storage__Local__RootPath  the photo storage folder the API uses (same variable the API reads)
#>
param(
  [Parameter(Mandatory = $true)][string]$Destination,
  [int]$KeepDatabaseBackups = 14
)
$ErrorActionPreference = "Stop"

$sqlServer = if ($env:STUDIOOS_SQL_SERVER) { $env:STUDIOOS_SQL_SERVER } else { "localhost\SQLEXPRESS" }
$dbName    = if ($env:STUDIOOS_DB_NAME) { $env:STUDIOOS_DB_NAME } else { "StudioManagementDb" }
$storage   = [Environment]::GetEnvironmentVariable("Storage__Local__RootPath", "Process")
if (-not $storage) { $storage = [Environment]::GetEnvironmentVariable("Storage__Local__RootPath", "Machine") }
if (-not $storage) { throw "Storage__Local__RootPath is not set - which folder holds the photo storage?" }

$dbDir = Join-Path $Destination "database"
$stDir = Join-Path $Destination "storage"
New-Item -ItemType Directory -Force $dbDir, $stDir | Out-Null

Write-Host "=== 1. Database ($dbName on $sqlServer)"
$bak = Join-Path $dbDir ("$dbName-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".bak")
# SQL Server writes this file itself, so its service account needs write access to $dbDir.
sqlcmd -S $sqlServer -E -b -Q "BACKUP DATABASE [$dbName] TO DISK = N'$bak' WITH COPY_ONLY, INIT" 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Database backup failed." }
Get-ChildItem $dbDir -Filter "$dbName-*.bak" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $KeepDatabaseBackups | Remove-Item -Force

Write-Host "`n=== 2. Photo storage ($storage)"
& robocopy $storage $stDir /MIR /NFL /NDL /NP /R:3 /W:2 | Out-Host
if ($LASTEXITCODE -ge 8) { throw "Copying the photo storage failed (robocopy $LASTEXITCODE)." }

Write-Host "`nBackup finished: $Destination"
exit 0
