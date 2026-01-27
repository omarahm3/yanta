# run-tests.ps1 - Run Go backend tests (Windows)
# Cross-platform: This script is only used on Windows, Unix uses inline shell commands
#
# Note: -race flag requires CGO and is skipped on Windows by default (requires MinGW/gcc)
#
# Environment variables:
# - GO_CACHE_DIR: Go cache directory (default: .gocache)
# - COVERAGE_OUT: Coverage output file (default: coverage.out)
# - ROOT_DIR: Project root directory (default: current directory)

param()

$ErrorActionPreference = "Stop"

# Setup parameters from environment
$GoCacheDir = [Environment]::GetEnvironmentVariable('GO_CACHE_DIR')
if (-not $GoCacheDir) { $GoCacheDir = ".gocache" }

$CoverageOut = [Environment]::GetEnvironmentVariable('COVERAGE_OUT')
if (-not $CoverageOut) { $CoverageOut = "coverage.out" }

$RootDir = [Environment]::GetEnvironmentVariable('ROOT_DIR')
if (-not $RootDir) { $RootDir = (Get-Location).Path }

# Setup Go cache directory
if (-not [System.IO.Path]::IsPathRooted($GoCacheDir)) {
    $GoCacheDir = Join-Path $RootDir $GoCacheDir
}

if (-not (Test-Path $GoCacheDir)) {
    New-Item -ItemType Directory -Path $GoCacheDir -Force | Out-Null
}

$env:GOCACHE = $GoCacheDir

# Change to root directory
Set-Location $RootDir

# Note about -race flag on Windows
Write-Host "Note: Skipping -race on Windows (requires CGO/MinGW)"

# Run tests with coverage
Write-Host "Running Go tests..."
& go test -v -coverprofile=$CoverageOut -covermode=atomic ./...

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Tests failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Backend tests passed"
exit 0
