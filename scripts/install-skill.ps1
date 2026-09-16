<#
.SYNOPSIS
  Install the bundled `writing-qoder-canvas` skill into a DSH skill root.

.DESCRIPTION
  DSH discovers skills from a fixed set of roots, and a skill must sit EXACTLY
  one level deep: <root>/<name>/SKILL.md. Nested `**/SKILL.md` files are not
  discovered (the provider watches each root with a chokidar depth of 1). That
  is why this script exists instead of "just point DSH at the repo".

  Roots, in the provider's rank order:

    rank  root            path
    ----  --------------  ----------------------------------------------
     100  project-dsh     <projectRoot>/.dsh/skills
     200  project-agents  <projectRoot>/.agents/skills
     300  custom          Config.customSkillDirs
     400  user-dsh        <dshHome>/skills          (~/.dsh/skills)
     500  user-agents     <agentsHome>/skills       (~/.agents/skills)
     600  bundled         $DSH_BUNDLED_SKILL_DIR

  The default target is `user-agents`, which is where this machine's other
  user-level skills already live.

  A JUNCTION is the default because it cannot drift: the repo copy stays the
  single source of truth and editing it updates the live skill immediately.
  Use -Copy for a portable, self-contained install (which then needs re-running
  after every repo change).

  The provider watches its roots, so a newly installed skill reaches the next
  session catalog without restarting `dsh web`.

.PARAMETER Target
  Which well-known root to install into. Default: UserAgents.

.PARAMETER Path
  An explicit root directory, overriding -Target.

.PARAMETER Copy
  Copy the files instead of creating a junction.

.PARAMETER Uninstall
  Remove the installed skill from the resolved root.

.PARAMETER Force
  Replace whatever is already there.

.EXAMPLE
  pwsh -NoProfile -File ./scripts/install-skill.ps1

.EXAMPLE
  pwsh -NoProfile -File ./scripts/install-skill.ps1 -Target UserDsh -Copy

.EXAMPLE
  pwsh -NoProfile -File ./scripts/install-skill.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  [ValidateSet('UserAgents', 'UserDsh', 'ProjectDsh', 'ProjectAgents')]
  [string]$Target = 'UserAgents',

  [string]$Path,

  [switch]$Copy,

  [switch]$Uninstall,

  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$SkillName = 'writing-qoder-canvas'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Source = Join-Path $RepoRoot ('skills\' + $SkillName)
$ProjectRoot = (Get-Location).Path

# --- resolve the root ------------------------------------------------------
function Resolve-Root {
  param([string]$Which, [string]$Explicit, [string]$Project)
  if ($Explicit) { return $Explicit }
  switch ($Which) {
    'UserAgents'    { return (Join-Path $env:USERPROFILE '.agents\skills') }
    'UserDsh'       { return (Join-Path $env:USERPROFILE '.dsh\skills') }
    'ProjectDsh'    { return (Join-Path $Project '.dsh\skills') }
    'ProjectAgents' { return (Join-Path $Project '.agents\skills') }
    default         { throw "unhandled target: $Which" }
  }
}

$root = Resolve-Root -Which $Target -Explicit $Path -Project $ProjectRoot
$dest = Join-Path $root $SkillName

# --- uninstall -------------------------------------------------------------
if ($Uninstall) {
  if (-not (Test-Path -LiteralPath $dest)) {
    Write-Host "not installed: $dest"
    exit 0
  }
  # A junction must be removed with Remove-Item on the link itself; without
  # -Force on a directory junction, PowerShell may follow it and delete the
  # REAL target. Confirm it is a link before we touch it.
  $item = Get-Item -LiteralPath $dest -Force
  $isLink = ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
  Remove-Item -LiteralPath $dest -Recurse -Force
  if ($isLink) {
    Write-Host "removed junction: $dest (the repo source was NOT touched)"
  } else {
    Write-Host "removed directory: $dest"
  }
  exit 0
}

# --- preconditions ---------------------------------------------------------
$manifest = Join-Path $Source 'SKILL.md'
if (-not (Test-Path -LiteralPath $manifest)) {
  throw "skill source not found: $manifest"
}

$text = Get-Content -LiteralPath $manifest -Raw
if ($text -notmatch '(?m)^---\s*$') {
  throw "SKILL.md has no YAML frontmatter"
}
$front = ($text -split '(?m)^---\s*$')[1]
foreach ($key in @('name', 'description')) {
  if ($front -notmatch ('(?m)^' + $key + '\s*:')) {
    throw "SKILL.md frontmatter is missing the required '$key' field"
  }
}
if ($front -notmatch ('(?m)^name\s*:\s*' + [regex]::Escape($SkillName) + '\s*$')) {
  Write-Warning "frontmatter name does not match the directory name '$SkillName'"
}

# --- install ---------------------------------------------------------------
if (-not (Test-Path -LiteralPath $root)) {
  New-Item -ItemType Directory -Path $root -Force | Out-Null
  Write-Host "created root: $root"
}

if (Test-Path -LiteralPath $dest) {
  $existing = Get-Item -LiteralPath $dest -Force
  $isLink = ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
  $pointsHere = $isLink -and ($existing.Target -contains $Source)
  if ($pointsHere -and -not $Copy) {
    Write-Host "already installed (junction -> $Source)"
    exit 0
  }
  if (-not $Force) {
    throw "$dest already exists. Re-run with -Force to replace it."
  }
  Remove-Item -LiteralPath $dest -Recurse -Force
}

if ($Copy) {
  Copy-Item -LiteralPath $Source -Destination $dest -Recurse -Force
  Write-Host "copied  $Source"
  Write-Host "     -> $dest"
  Write-Host ""
  Write-Host "NOTE: a copy drifts. Re-run this script after editing the skill."
} else {
  New-Item -ItemType Junction -Path $dest -Target $Source | Out-Null
  Write-Host "linked  $Source"
  Write-Host "     -> $dest"
}

# --- verify the layout DSH actually scans ----------------------------------
$installed = Join-Path $dest 'SKILL.md'
if (-not (Test-Path -LiteralPath $installed)) { throw "install failed: $installed missing" }

$relative = $installed.Substring($root.Length).TrimStart('\', '/')
$depth = ($relative -split '[\\/]').Count
if ($depth -ne 2) {
  throw "layout is wrong: expected <root>/$SkillName/SKILL.md, got $relative"
}

Write-Host ""
Write-Host "OK - discovered as $SkillName from root '$Target'"
Write-Host "     $installed"
Write-Host ""
Write-Host "The provider watches roots, so this reaches the next session catalog"
Write-Host "without restarting dsh web."
