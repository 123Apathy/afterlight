# Deploy Everlit to Netlify WITHOUT burning build credits.
#
# Why this exists: pushing to the netlify-migration branch triggers a build on
# Netlify's servers, and server-side builds are what consume the free tier's
# monthly credits (we burned 75% of them in 3 days of push-per-tweak).
# `netlify deploy` instead builds ON THIS PC (expo export, per netlify.toml)
# and just uploads the finished dist/ + the api function -- Netlify charges
# nothing for that.
#
# NOTE: a plain drag-and-drop of dist/ into the Netlify UI would NOT work as
# an alternative -- drag-drop deploys are static-only, and each deploy fully
# replaces the previous one, so the api function (uploads, /join links,
# /admin) would vanish from the site until the next git/CLI deploy.
#
# First run only: a browser window opens for Netlify login (one time, token
# is stored locally after that).

$ErrorActionPreference = 'Stop'
Set-Location 'D:\Hermes Work\afterlight'

$SiteId = 'ec87ba90-c5f3-44b1-9f94-e78adbc253da'  # afterlight-memorial / everlit.co.za

Write-Host ''
Write-Host '=== Deploy Everlit (everlit.co.za) ===' -ForegroundColor Cyan

# Snapshot the latest local progress FIRST. We only commit here (never git
# push) -- the deploy below uploads via the Netlify CLI, so production goes
# live from this commit without any branch push burning build credits.
$pending = git status --porcelain
if ($pending) {
    Write-Host 'Committing latest local progress before deploy...' -ForegroundColor Gray
    git add -A
    git commit -q -m "Deploy snapshot $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    if ($LASTEXITCODE -ne 0) { Write-Host 'Commit failed. Nothing deployed.' -ForegroundColor Red; exit 1 }
} else {
    Write-Host 'No new local changes to commit.' -ForegroundColor Gray
}

# One-time login if needed (opens browser, waits for you to approve).
# NOTE: `netlify api getCurrentUser` exits 0 even when unauthorized, so we must
# inspect its OUTPUT (a logged-in reply contains the account "id"), not $?.
#
# BUG FIXED 2026-07-27: under $ErrorActionPreference = 'Stop', PowerShell 5.1
# turns a native command's stderr (merged in via 2>&1) into a TERMINATING
# NativeCommandError -- so an expired login didn't hit the "not logged in,
# opening browser" branch below, it crashed the whole script before that
# check ever ran (Deon saw a raw "Unauthorized" NativeCommandError and the
# deploy silently never happened, no browser opened). This check now runs
# with errors set to non-terminating, restored right after either way.
function Get-NetlifyWhoAmI {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { npx netlify api getCurrentUser 2>&1 | Out-String }
    finally { $ErrorActionPreference = $prev }
}
$who = Get-NetlifyWhoAmI
if ($who -notmatch '"id"') {
    Write-Host 'Not logged in to Netlify (or the login expired) -- opening browser to log in again...' -ForegroundColor Yellow
    npx netlify login
    if ($LASTEXITCODE -ne 0) { Write-Host 'Login failed/cancelled. Nothing deployed.' -ForegroundColor Red; exit 1 }
    # Re-check after login.
    $who = Get-NetlifyWhoAmI
    if ($who -notmatch '"id"') { Write-Host 'Still not authenticated. Nothing deployed.' -ForegroundColor Red; exit 1 }
}

Write-Host 'Building locally (expo export) and uploading -- no Netlify build credits used.' -ForegroundColor Gray

# CRITICAL (learned 2026-07-27): the dev .env bakes EXPO_PUBLIC_API_BASE
# (the PC's LAN IP) into the production bundle, which pointed the LIVE site's
# API at Deon's desktop -- photos broke for everyone off this network and
# browsers showed a local-network permission prompt. The .env is moved aside
# for the build, and --clear defeats Metro's transform cache, which otherwise
# keeps the OLD inlined value even after the env changes.
$envMoved = $false
if (Test-Path '.env') { Rename-Item '.env' '.env.deploy-bak'; $envMoved = $true }
try {
    npx expo export --platform web --clear
    if ($LASTEXITCODE -ne 0) { throw 'expo export failed' }
    # Landing page + legal pages + card images live in public/, overlaid onto
    # the export output (expo copies public/ itself, this is belt-and-braces).
    Copy-Item -Path 'public\*' -Destination 'dist' -Recurse -Force
    npx netlify deploy --prod --no-build --site $SiteId
} finally {
    if ($envMoved -and (Test-Path '.env.deploy-bak')) { Rename-Item '.env.deploy-bak' '.env' }
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ''
    Write-Host 'LIVE: https://everlit.co.za' -ForegroundColor Green
} else {
    Write-Host ''
    Write-Host 'Deploy FAILED -- production is unchanged (still on the previous deploy).' -ForegroundColor Red
    exit 1
}
