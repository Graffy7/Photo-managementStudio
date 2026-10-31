# Takes a full COPY_ONLY backup of the Studio OS database (all tables, keys, indexes and records),
# verifies it, and writes a per-table row count next to it. The live database is only read;
# COPY_ONLY leaves SQL Server's own backup chain untouched.
#
#   powershell -ExecutionPolicy Bypass -File tools\transfer\backup-database.ps1 -OutDir D:\StudioOS-transfer
#
param(
    [Parameter(Mandatory = $true)][string]$OutDir,
    [string]$Server = "localhost",
    [string]$Database = "StudioManagementDb"
)
$ErrorActionPreference = "Stop"
# The SQL Server service account (it reads/writes .bak files itself, so it needs folder permission).
function Get-SqlServiceAccount([string]$Server) {
    $instance = (sqlcmd -S $Server -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT ISNULL(CAST(SERVERPROPERTY('InstanceName') AS nvarchar(128)), 'MSSQLSERVER')").Trim()
    if ($instance -eq "MSSQLSERVER") { "NT Service\MSSQLSERVER" } else { "NT Service\MSSQL`$$instance" }
}

New-Item -ItemType Directory -Force $OutDir | Out-Null
$OutDir = (Resolve-Path $OutDir).Path
icacls $OutDir /grant "$(Get-SqlServiceAccount $Server):(OI)(CI)M" | Out-Null

$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$bak = Join-Path $OutDir "${Database}_$stamp.bak"
# Backup compression isn't available on SQL Server Express (EngineEdition 4).
$edition = (sqlcmd -S $Server -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('EngineEdition') AS int)").Trim()
$compression = if ($edition -eq "4") { "" } else { "COMPRESSION, " }

sqlcmd -S $Server -E -C -b -Q "BACKUP DATABASE [$Database] TO DISK = N'$bak' WITH COPY_ONLY, CHECKSUM, ${compression}INIT, NAME = N'$Database copy-only $stamp'"
if ($LASTEXITCODE -ne 0) { throw "Backup failed." }
sqlcmd -S $Server -E -C -b -Q "RESTORE VERIFYONLY FROM DISK = N'$bak' WITH CHECKSUM"
if ($LASTEXITCODE -ne 0) { throw "The backup file did not verify." }

$counts = Join-Path $OutDir "${Database}_$stamp.row-counts.csv"
sqlcmd -S $Server -d $Database -E -C -W -s "," -Q "SET NOCOUNT ON; SELECT t.name AS [Table], SUM(p.rows) AS [Rows] FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1) GROUP BY t.name ORDER BY t.name;" |
    Where-Object { $_ -notmatch '^-' } | Out-File $counts -Encoding utf8

Write-Host "Backup:     $bak ($([math]::Round((Get-Item $bak).Length / 1MB, 1)) MB, verified)"
Write-Host "Row counts: $counts"
