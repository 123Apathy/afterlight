# commit-everlit.ps1
# Commits whatever is outstanding in the Everlit working tree, locally only.
#
# WHY THIS EXISTS
#   Everlit's standing rule is: commit locally, never push, and never deploy as
#   a side effect. Deploying costs credits and only Deon decides when it
#   happens (that is what "Deploy Everlit.cmd" is for). This script therefore
#   does exactly one thing and refuses to do anything else.
#
# WHAT IT WILL NOT DO
#   - push (no git push, no remote write of any kind)
#   - deploy
#   - commit on the default branch (main). It stops and tells you instead.
#   - commit while typecheck is failing
#
# Delegated to by: OneDrive\Desktop\Launch Scripts\Commit Everlit.cmd

$ErrorActionPreference = 'Stop'
$repo = 'D:\Hermes Work\afterlight'

function Say($msg, $colour = 'Gray') { Write-Host $msg -ForegroundColor $colour }

if (-not (Test-Path $repo)) { Say "Repo not found at $repo" 'Red'; exit 1 }
Set-Location $repo

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Say ""
Say "Everlit  |  branch: $branch" 'Cyan'

# Guard: never commit straight onto the default branch.
if ($branch -eq 'main' -or $branch -eq 'master') {
  Say ""
  Say "Refusing to commit on '$branch'." 'Red'
  Say "Everlit's working line is 'netlify-migration'. Switch to it, or make a" 'Yellow'
  Say "branch first, then run this again." 'Yellow'
  exit 1
}

$dirty = git status --porcelain
if (-not $dirty) {
  Say ""
  Say "Nothing to commit, the working tree is already clean." 'Green'
  $ahead = (git rev-list --count "origin/$branch..HEAD" 2>$null)
  if ($ahead) { Say "$ahead commit(s) sit locally, unpushed. That is expected." 'Gray' }
  Say ""
  Start-Sleep -Seconds 3
  exit 0
}

Say ""
Say "Outstanding changes:" 'White'
git status --short
Say ""

# Gate: the project's own rule is that tsc stays green.
Say "Typechecking before commit..." 'White'
& npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
  Say ""
  Say "TypeScript is failing. Nothing was committed." 'Red'
  Say "Fix the errors above, then run this again." 'Yellow'
  exit 1
}
Say "Typecheck clean." 'Green'

$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
$msg = @"
chore: checkpoint working tree ($stamp)

Committed from Commit Everlit.cmd. Local only, not pushed and not deployed.
Typecheck was green at commit time.
"@

# -F <file>, not -m: keeps the body intact and avoids quoting games in 5.1.
# WriteAllText with an explicit BOM-less encoder. Set-Content -Encoding utf8 on
# PowerShell 5.1 emits a BOM, and git keeps it, so the subject line renders as
# a stray glyph in every log.
$tmp = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmp, $msg, (New-Object System.Text.UTF8Encoding($false)))
git add -A
git commit -q -F $tmp
$committed = ($LASTEXITCODE -eq 0)
Remove-Item $tmp -Force

if (-not $committed) {
  Say ""
  Say "git commit failed. Nothing was committed." 'Red'
  exit 1
}

Say ""
Say "Committed:" 'Green'
git --no-pager log --oneline -1
Say ""
Say "NOT pushed and NOT deployed, on purpose." 'Yellow'
Say "To publish to everlit.co.za, use 'Deploy Everlit.cmd'." 'Gray'
Say ""
Start-Sleep -Seconds 4
