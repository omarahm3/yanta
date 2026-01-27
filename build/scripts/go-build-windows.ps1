# Windows Go Build Script for YANTA
# This script handles the Go build process on Windows, including:
# - Go cache setup
# - Windows resource (.syso) generation
# - Go binary compilation
# - Optional NSIS installer creation
#
# Parameters are passed via environment variables:
# - BUILD_TARGET: Target platform (win, windows, ubuntu, arch, osx)
# - BUILD_DEBUG: Enable debug mode (0 or 1)
# - APP_NAME: Application name (default: yanta)
# - BIN_DIR: Output directory (default: build/bin)
# - GO_CACHE_DIR: Go cache directory (default: .gocache)
# - YANTA_VERSION: Version override (optional)

param()

$ErrorActionPreference = "Stop"

# Read parameters from environment
$Target = $env:BUILD_TARGET
if (-not $Target) { $Target = "local" }
$Debug = $env:BUILD_DEBUG
if (-not $Debug) { $Debug = "0" }
$AppName = $env:APP_NAME
if (-not $AppName) { $AppName = "yanta" }
$BinDir = $env:BIN_DIR
if (-not $BinDir) { $BinDir = "build/bin" }

# Setup Go cache directory
$GoCacheDir = $env:GO_CACHE_DIR
if (-not $GoCacheDir) { $GoCacheDir = ".gocache" }
if (-not [System.IO.Path]::IsPathRooted($GoCacheDir)) {
    $GoCacheDir = Join-Path (Get-Location) $GoCacheDir
}
if (-not (Test-Path $GoCacheDir)) {
    New-Item -ItemType Directory -Path $GoCacheDir -Force | Out-Null
}
$env:GOCACHE = $GoCacheDir

# Auto-detect target if "local" - on Windows, default to win
if ([string]::IsNullOrEmpty($Target) -or $Target -eq "local") {
    $Target = "win"
}

# Platform-specific configuration
$UseWebkit41 = $false
$GoosTarget = ""
$GoarchTarget = "amd64"
$CcOverride = ""
$CxxOverride = ""
$OutputSuffix = ""
$BuildTags = @()

switch ($Target) {
    { $_ -in @("win", "windows") } {
        $GoosTarget = ""  # Native build on Windows
        $OutputSuffix = ".exe"
        $BuildTags = @()

        # Generate Windows resources (.syso) for icon embedding
        Write-Host "Generating Windows resources..."
        if (-not (Get-Command "go-winres" -ErrorAction SilentlyContinue)) {
            Write-Host "Installing go-winres..."
            go install github.com/tc-hib/go-winres@latest
        }

        # Get version for Windows resources
        $WinresVersion = $env:YANTA_VERSION
        if (-not $WinresVersion) {
            try {
                $VersionTag = git describe --tags --abbrev=0 2>$null
                if ($VersionTag) {
                    $WinresVersion = $VersionTag -replace "^v", ""
                }
            } catch {}
        }
        if (-not $WinresVersion) { $WinresVersion = "1.0.0" }

        # Generate .syso file
        & go-winres simply `
            --icon build/windows/icon.ico `
            --out rsrc_windows `
            --arch amd64 `
            --manifest gui `
            --product-name "YANTA" `
            --file-description "YANTA - Yet Another Note Taking App" `
            --copyright "Copyright (c) 2024-2025 Omar Ahmed" `
            --original-filename "yanta.exe" `
            --product-version $WinresVersion `
            --file-version $WinresVersion

        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Write-Host "Windows resources generated (rsrc_windows_windows_amd64.syso)"
    }
    { $_ -in @("ubuntu", "arch") } {
        Write-Host "ERROR: Linux targets (ubuntu, arch) must be built on Linux" -ForegroundColor Red
        exit 1
    }
    { $_ -in @("osx", "mac", "macos") } {
        Write-Host "ERROR: macOS targets must be built on macOS" -ForegroundColor Red
        exit 1
    }
    default {
        Write-Host "ERROR: Unknown target: $Target" -ForegroundColor Red
        Write-Host "Valid targets: win, ubuntu, arch, osx"
        exit 1
    }
}

# Get version info
$Commit = "unknown"
try { $Commit = git rev-parse --short HEAD 2>$null } catch {}
if ([string]::IsNullOrEmpty($Commit)) { $Commit = "unknown" }

$Version = $env:YANTA_VERSION
if (-not $Version) {
    try {
        $VersionTag = git describe --tags --abbrev=0 2>$null
        if ($VersionTag) {
            $Version = $VersionTag -replace "^v", ""
        }
    } catch {}
}
if (-not $Version) { $Version = "dev-$Commit" }

$Date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# Build LD flags
$LdFlags = "-X yanta/internal/system.BuildVersion=$Version"
$LdFlags += " -X yanta/internal/system.BuildCommit=$Commit"
$LdFlags += " -X yanta/internal/system.BuildDate=$Date"

if ($Target -in @("win", "windows")) {
    $LdFlags += " -H=windowsgui"
}

Write-Host "========================================"
Write-Host "Building: $AppName"
Write-Host "Target:   $Target"
Write-Host "Version:  $Version"
Write-Host "Commit:   $Commit"
Write-Host "========================================"

# Setup output path
$OutputPath = Join-Path $BinDir "$AppName$OutputSuffix"

# Build environment
$env:GOARCH = $GoarchTarget
$env:CGO_ENABLED = "1"
if ($GoosTarget) { $env:GOOS = $GoosTarget }
if ($CcOverride) { $env:CC = $CcOverride; $env:CXX = $CxxOverride }

# Debug mode
if ($Debug -eq "1") {
    $env:YANTA_DEBUG_BUILD = "1"
    Write-Host "Debug mode enabled"
}

# Execute build
Write-Host "Compiling Go binary..."
$BuildArgs = @("-ldflags", $LdFlags, "-o", $OutputPath, ".")
if ($BuildTags.Count -gt 0) {
    $TagsArg = $BuildTags -join ","
    $BuildArgs = @("-tags", $TagsArg) + $BuildArgs
}
& go build @BuildArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Build complete: $OutputPath"

# Create Windows installer using NSIS (if available)
if ($Target -in @("win", "windows")) {
    if (Get-Command "makensis" -ErrorAction SilentlyContinue) {
        Write-Host "Creating Windows installer..."
        $NsiDir = "build\windows\installer"
        $NsiFile = Join-Path $NsiDir "project.nsi"
        if (Test-Path $NsiFile) {
            $AbsNsiDir = (Resolve-Path $NsiDir).Path
            $AbsBinary = (Resolve-Path $OutputPath).Path
            & makensis "/X!addincludedir $AbsNsiDir" "-DARG_WAILS_AMD64_BINARY=$AbsBinary" $NsiFile
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Windows installer created"
            } else {
                Write-Host "WARNING: NSIS installer creation failed" -ForegroundColor Yellow
            }
        } else {
            Write-Host "WARNING: NSIS script not found at $NsiFile, skipping installer" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Note: makensis not found, skipping installer creation"
    }
}

exit 0
