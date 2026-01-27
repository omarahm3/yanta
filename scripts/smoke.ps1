# smoke.ps1 - Run cross-platform Taskfile smoke checks (Windows)

$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RootDir

Write-Host "==> Running smoke tests in $RootDir"
function Invoke-Task {
  param([string]$Name)
  & task $Name
  if ($LASTEXITCODE -ne 0) {
    throw "Task failed: $Name (exit $LASTEXITCODE)"
  }
}

Write-Host "==> Step 1/4: backend tests"
Invoke-Task "test:backend"

Write-Host "==> Step 2/4: build"
Invoke-Task "build"

Write-Host "==> Step 3/4: release artifacts"
Invoke-Task "release:all"

Write-Host "==> Step 4/4: verify artifacts"
Invoke-Task "release:verify"

Write-Host "==> Smoke tests complete"
