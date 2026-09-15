<#
.SYNOPSIS
  Check (and optionally repair) the dsh-canvas-tsx-sidebar mount in a DSH profile.

.DESCRIPTION
  Read-only by default. Reports, in the order they can fail:

    1. profile directory exists
    2. the package is present in the profile's node_modules (and where a
       link: mount actually points)
    3. the profile records the package in `dsh.profile.bundles` -- the load
       list `dsh web` actually walks
    4. this plugin's own lib/ is BUILT, because a link: mount ships whatever
       is on disk at load time; an unbuilt package mounts to a silent no-op

  Pass -Apply to add a missing `dsh.profile.bundles` entry (idempotent).

  History: this script used to look only for an `insert:` row in
  cordis.patch.yml. That is NOT how the web profile loads plugins -- its
  patch file carries only disabled/config overrides, and every plugin is
  listed in dsh.profile.bundles instead. The old check therefore reported a
  healthy mount as broken and told the operator to add a row that would
  double-register the tab.

  NOTE: this file is deliberately pure ASCII. Windows PowerShell 5.1 reads
  BOM-less .ps1 files as ANSI, which mangles non-ASCII output.

.PARAMETER Profile
  DSH profile name under ~/.dsh/profiles. Defaults to 'web'.

.PARAMETER Apply
  Add the missing dsh.profile.bundles entry.

.EXAMPLE
  powershell -NoProfile -File ./scripts/mount-check.ps1
  powershell -NoProfile -File ./scripts/mount-check.ps1 -Apply
#>
[CmdletBinding()]
param(
  [string]$Profile = 'web',
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'

$pluginName = 'dsh-canvas-tsx-sidebar'
$profileDir = Join-Path $env:USERPROFILE ".dsh\profiles\$Profile"
$pkgJson    = Join-Path $profileDir 'package.json'
$mounted    = Join-Path $profileDir "node_modules\$pluginName"
$pluginDir  = Split-Path -Parent $PSScriptRoot
$exitCode   = 0

Write-Host "== $pluginName - mount check (profile: $Profile)" -ForegroundColor Cyan

if (-not (Test-Path $profileDir)) {
  Write-Host "FAIL profile directory not found: $profileDir" -ForegroundColor Red
  exit 2
}
Write-Host "OK   profile dir      : $profileDir"

# -- 2. package present ------------------------------------------------------
if (Test-Path $mounted) {
  $item = Get-Item $mounted -Force
  if ($null -ne $item.LinkType) {
    Write-Host "OK   package present  : $($item.LinkType) -> $($item.Target)"
  } else {
    Write-Host "OK   package present  : $mounted"
  }
} else {
  Write-Host "WARN package NOT in profile node_modules" -ForegroundColor Yellow
  Write-Host "     -> dsh plugin --profile $Profile add link:$pluginDir"
  $exitCode = 1
}

# -- 3. bundles entry --------------------------------------------------------
if (-not (Test-Path $pkgJson)) {
  Write-Host "FAIL no package.json at $pkgJson" -ForegroundColor Red
  exit 2
}

$raw = Get-Content $pkgJson -Raw
$listed = $false
try {
  $parsed = $raw | ConvertFrom-Json
  $bundles = @($parsed.dsh.profile.bundles)
  $listed = $bundles -contains $pluginName
} catch {
  Write-Host "FAIL package.json is not valid JSON: $($_.Exception.Message)" -ForegroundColor Red
  exit 2
}

if ($listed) {
  Write-Host "OK   bundles entry    : dsh.profile.bundles ($($bundles.Count) entries)"
} else {
  Write-Host "WARN bundles entry MISSING in dsh.profile.bundles" -ForegroundColor Yellow
  if ($Apply) {
    Copy-Item $pkgJson "$pkgJson.bak-canvas" -Force
    $raw = $raw -replace '(?s)("bundles"\s*:\s*\[)(.*?)(\r?\n\s*\])', "`$1`$2,`n        `"$pluginName`"`$3"
    Set-Content $pkgJson -Value $raw -NoNewline -Encoding utf8
    Write-Host "FIX  appended the bundles entry (backup: package.json.bak-canvas)" -ForegroundColor Green
  } else {
    Write-Host "     -> re-run with -Apply, or add it by hand"
    $exitCode = 1
  }
}

# -- 4. our own build output -------------------------------------------------
$clientBundle = Join-Path $pluginDir 'lib\client.js'
$hostEntry    = Join-Path $pluginDir 'lib\index.mjs'
$missing = @()
foreach ($artifact in @($clientBundle, $hostEntry)) {
  if (-not (Test-Path $artifact)) { $missing += $artifact }
}
if ($missing.Count -eq 0) {
  $size = (Get-Item $clientBundle).Length
  Write-Host "OK   plugin built     : lib/client.js ($size B), lib/index.mjs"
} else {
  Write-Host "FAIL plugin NOT built - a link: mount loads whatever is on disk" -ForegroundColor Red
  Write-Host "     -> npm run build   (in $pluginDir)"
  $exitCode = 2
}

# -- informational: the legacy patch-row route -------------------------------
$patchFile = Join-Path $profileDir 'cordis.patch.yml'
if (Test-Path $patchFile) {
  $patchText = Get-Content $patchFile -Raw
  $rowPresent = [regex]::IsMatch($patchText, "(?m)^\s*-\s*id:\s*['""]?$([regex]::Escape($pluginName))['""]?\s*$")
  if ($rowPresent) {
    Write-Host "INFO patch row also present in cordis.patch.yml (not required)" -ForegroundColor DarkGray
  }
}

Write-Host ""
Write-Host "Remember: a NEW bundle needs a 'dsh web' restart, then a hard browser refresh." -ForegroundColor DarkGray
exit $exitCode
