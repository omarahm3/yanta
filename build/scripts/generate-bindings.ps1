# generate-bindings.ps1 - Generate TypeScript bindings from Go services (Windows)
# Cross-platform: This script is only used on Windows, Unix uses inline shell commands
#
# Environment variables:
# - SKIP_WAILS_BINDINGS: Set to '1' to skip binding generation
# - GO_CACHE_DIR: Go cache directory (default: .gocache)

param()

$ErrorActionPreference = "Stop"

# Check if binding generation should be skipped
$SkipBindings = [Environment]::GetEnvironmentVariable('SKIP_WAILS_BINDINGS')
if ($SkipBindings -eq '1') {
    Write-Host "Skipping binding generation (SKIP_WAILS_BINDINGS=1)"
    exit 0
}

# Setup Go cache directory
$GoCacheDir = [Environment]::GetEnvironmentVariable('GO_CACHE_DIR')
if (-not $GoCacheDir) { $GoCacheDir = ".gocache" }

if (-not [System.IO.Path]::IsPathRooted($GoCacheDir)) {
    $GoCacheDir = Join-Path (Get-Location) $GoCacheDir
}

if (-not (Test-Path $GoCacheDir)) {
    New-Item -ItemType Directory -Path $GoCacheDir -Force | Out-Null
}

# Set environment variables for the build
$env:GOCACHE = $GoCacheDir
$env:GOFLAGS = ""

# Run wails3 generate bindings
Write-Host "Running wails3 generate bindings..."
& wails3 generate bindings -clean=true -ts

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: wails3 generate bindings failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "TypeScript bindings generated successfully"
exit 0
