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

# One-time login if needed (opens browser, waits for you to approve).
npx netlify api getCurrentUser *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Not logged in to Netlify yet -- opening browser for one-time login...' -ForegroundColor Yellow
    npx netlify login
    if ($LASTEXITCODE -ne 0) { Write-Host 'Login failed/cancelled. Nothing deployed.' -ForegroundColor Red; exit 1 }
}

Write-Host 'Building locally (expo export) and uploading -- no Netlify build credits used.' -ForegroundColor Gray
npx netlify deploy --prod --site $SiteId

if ($LASTEXITCODE -eq 0) {
    Write-Host ''
    Write-Host 'LIVE: https://everlit.co.za' -ForegroundColor Green
} else {
    Write-Host ''
    Write-Host 'Deploy FAILED -- production is unchanged (still on the previous deploy).' -ForegroundColor Red
    exit 1
}
