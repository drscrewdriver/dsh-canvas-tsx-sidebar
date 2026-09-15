<#
.SYNOPSIS
  Check (and optionally repair) the dsh-canvas-tsx-sidebar mount in a DSH profile.

.DESCRIPTION
  Read-only by default: reports whether the plugin is present in the profile's
  node_modules and whether the profile's cordis.patch.yml carries its insert
  row. Pass -Apply to add the missing patch row (idempotent: a second run
  changes nothing).

  The official CLI path (`dsh plugin --profile <p> add <pkg.tgz>`) also appends
  the package to `dsh.profile.bundles`; this script only covers the manual
  route. Do NOT use both.

  NOTE: this file is deliberately pure ASCII. Windows PowerShell 5.1 reads
  BOM-less .ps1 files as ANSI, which mangles non-ASCII text in output and can
  corrupt string literals on older builds.

.PARAMETER Profile
  DSH profile name under ~/.dsh/profiles. Defaults to 'web'.

.PARAMETER Apply
  Write the missing insert row into the profile's cordis.patch.yml.

.EXAMPLE
  powershell -NoProfile -File ./scripts/mount-check.ps1
  powershell -NoProfile -File ./scripts/mount-check.ps1 -Profile web -Apply
#>
[CmdletBinding()]
param(
  [string]$Profile = 'web',
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$pluginName = 'dsh-canvas-tsx-sidebar'
$profileDir = Join-Path $env:USERPROFILE ".dsh\profiles\$Profile"
$patchFile  = Join-Path $profileDir 'cordis.patch.yml'
$pkgDir     = Join-Path $profileDir "node_modules\$pluginName"

Write-Host "== $pluginName - mount check (profile: $Profile)" -ForegroundColor Cyan

if (-not (Test-Path $profileDir)) {
  Write-Host "FAIL profile directory not found: $profileDir" -ForegroundColor Red
  exit 2
}
Write-Host "OK   profile dir      : $profileDir"

if (Test-Path $pkgDir) {
  Write-Host "OK   package present  : $pkgDir"
} else {
  Write-Host "WARN package NOT in profile node_modules" -ForegroundColor Yellow
  Write-Host "     -> run: dsh plugin --profile $Profile add <pkg.tgz>"
  Write-Host "     -> or : pnpm add link:<plugin path> inside the profile dir"
}

if (-not (Test-Path $patchFile)) {
  Write-Host "WARN no cordis.patch.yml at $patchFile" -ForegroundColor Yellow
  exit 1
}

$patchText = Get-Content $patchFile -Raw
# Match the id at the start of a YAML list item, so a mention inside a comment
# (this plugin's own patch file documents the manual route in prose) does not
# count as a real mount.
$rowPresent = [regex]::IsMatch($patchText, "(?m)^\s*-\s*id:\s*['""]?$([regex]::Escape($pluginName))['""]?\s*$")

if ($rowPresent) {
  Write-Host "OK   patch row present: $patchFile"
} else {
  Write-Host "WARN patch row MISSING in $patchFile" -ForegroundColor Yellow
  if ($Apply) {
    $block = "`n- insert:`n    - id: $pluginName`n      name: $pluginName`n"
    Add-Content -Path $patchFile -Value $block -NoNewline -Encoding utf8
    Write-Host "FIX  appended insert row" -ForegroundColor Green
  } else {
    Write-Host "     -> re-run with -Apply to append it"
  }
}

Write-Host ""
Write-Host "Remember: a NEW bundle needs a 'dsh web' restart, then a hard browser refresh." -ForegroundColor DarkGray
