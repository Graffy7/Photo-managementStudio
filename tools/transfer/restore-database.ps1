# Restores a Studio OS database backup (.bak) on this computer, with all its records.
#
# Safe by default: if a database with that name already exists it STOPS. Pass -Replace to replace
# it - the existing database is then backed up first (next to the .bak) so nothing is lost.
#
#   powershell -ExecutionPolicy Bypass -File tools\transfer\restore-database.ps1 -BakFile D:\StudioOS-transfer\database\StudioManagementDb_2026-10-31.bak
#   ...same, plus -Replace   (only when you mean to swap in the newer copy)
#
param(
    [Parameter(Mandatory = $true)][string]$BakFile,
    [string]$Server = "localhost",
    [string]$Database = "StudioManagementDb",
    [switch]$Replace
)
$ErrorActionPreference = "Stop"
# The SQL Server service account (it reads/writes .bak files itself, so it needs folder permission).
function Get-SqlServiceAccount([string]$Server) {
    $instance = (sqlcmd -S $Server -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT ISNULL(CAST(SERVERPROPERTY('InstanceName') AS nvarchar(128)), 'MSSQLSERVER')").Trim()
    if ($instance -eq "MSSQLSERVER") { "NT Service\MSSQLSERVER" } else { "NT Service\MSSQL`$$instance" }
}
$BakFile = (Resolve-Path $BakFile).Path
$folder = Split-Path $BakFile

# The SQL Server service reads the file itself, so it needs permission on the folder.
icacls $folder /grant "$(Get-SqlServiceAccount $Server):(OI)(CI)M" 2>$null | Out-Null

sqlcmd -S $Server -E -C -b -Q "RESTORE VERIFYONLY FROM DISK = N'$BakFile' WITH CHECKSUM"
if ($LASTEXITCODE -ne 0) { throw "The backup file is damaged or unreadable - nothing was changed." }

$exists = (sqlcmd -S $Server -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.databases WHERE name = N'$Database'").Trim() -ne "0"
if ($exists -and -not $Replace) {
    throw "A database named $Database already exists on this computer. Nothing was changed. Run again with -Replace to replace it (it will be backed up first)."
}
if ($exists) {
    $safety = Join-Path $folder "${Database}_before-restore_$(Get-Date -Format yyyy-MM-dd_HHmmss).bak"
    sqlcmd -S $Server -E -C -b -Q "BACKUP DATABASE [$Database] TO DISK = N'$safety' WITH COPY_ONLY, CHECKSUM, INIT"
    if ($LASTEXITCODE -ne 0) { throw "Couldn't back up the existing $Database first - nothing was changed." }
    Write-Host "Existing database backed up to $safety"
}

# Put the data and log files in this server's default folders.
$dataDir = (sqlcmd -S $Server -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400))").Trim()
$logDir = (sqlcmd -S $Server -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(400))").Trim()
$files = sqlcmd -S $Server -E -C -h -1 -W -s "|" -Q "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'$BakFile'" | Where-Object { $_ -match '\|' }
$moves = ($files | ForEach-Object {
    $p = $_ -split '\|'
    if ($p[2] -eq 'L') { "MOVE N'$($p[0])' TO N'$logDir$Database`_log.ldf'" } else { "MOVE N'$($p[0])' TO N'$dataDir$Database.mdf'" }
}) -join ", "

$replaceOption = if ($exists) { "REPLACE, " } else { "" }
if ($exists) { sqlcmd -S $Server -E -C -Q "ALTER DATABASE [$Database] SET SINGLE_USER WITH ROLLBACK IMMEDIATE" | Out-Null }
sqlcmd -S $Server -E -C -b -Q "RESTORE DATABASE [$Database] FROM DISK = N'$BakFile' WITH ${replaceOption}$moves, CHECKSUM, RECOVERY"
$ok = $LASTEXITCODE -eq 0
sqlcmd -S $Server -E -C -Q "IF DB_ID(N'$Database') IS NOT NULL ALTER DATABASE [$Database] SET MULTI_USER" | Out-Null
if (-not $ok) { throw "Restore failed." }

sqlcmd -S $Server -d $Database -E -C -W -Q "SET NOCOUNT ON; SELECT COUNT(*) AS Tables, SUM(p.rows) AS TotalRows FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1);"
Write-Host "Restored $Database. Compare TotalRows with the row-counts file that came with the backup."
