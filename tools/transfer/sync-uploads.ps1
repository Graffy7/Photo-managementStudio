# Copies the app's uploaded files (gallery previews/thumbnails, studio logos, signatures) between
# this project and a transfer folder. It only ever ADDS or UPDATES files - it never deletes.
#
#   Export (before leaving a computer):
#     powershell -ExecutionPolicy Bypass -File tools\transfer\sync-uploads.ps1 -To D:\StudioOS-transfer\uploads
#   Import (on the computer you arrive at):
#     powershell -ExecutionPolicy Bypass -File tools\transfer\sync-uploads.ps1 -From D:\StudioOS-transfer\uploads
#
param([string]$To, [string]$From)
$ErrorActionPreference = "Stop"
$uploads = Join-Path $PSScriptRoot "..\..\backend\StudioManagement.API\wwwroot\uploads"
$uploads = (Resolve-Path $uploads).Path
if ($To) { $src = $uploads; $dst = $To }
elseif ($From) { $src = $From; $dst = $uploads }
else { throw "Give -To <folder> (export) or -From <folder> (import)." }

# /E copies subfolders; /XO skips files where the destination is newer. No /MIR or /PURGE: nothing is deleted.
robocopy $src $dst /E /XO /R:1 /W:1 /NFL /NDL /NP | Select-Object -Last 12
if ($LASTEXITCODE -ge 8) { throw "Copy failed (robocopy code $LASTEXITCODE)." }
$a = Get-ChildItem $src -Recurse -File; $b = Get-ChildItem $dst -Recurse -File
Write-Host ("Source {0} files, destination {1} files." -f $a.Count, $b.Count)
