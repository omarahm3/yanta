# info.ps1 - Display build system information (Windows)
# Cross-platform: This script is only used on Windows, Unix uses inline shell commands

param(
    [string]$AppName = "yanta",
    [string]$BinDir = "build/bin",
    [string]$DistDir = "build/dist",
    [string]$Platform = "windows"
)

$ErrorActionPreference = 'SilentlyContinue'

# Get commit hash
$commit = git rev-parse --short HEAD 2>$null
if (-not $commit) { $commit = 'unknown' }

# Get version: YANTA_VERSION > git tag > dev-commit
$version = $env:YANTA_VERSION
if (-not $version) {
    $tag = git describe --tags --abbrev=0 2>$null
    if ($tag) {
        $version = $tag -replace '^v', ''
    } else {
        $version = "dev-$commit"
    }
}

Write-Host 'Yanta Build System'
Write-Host '=================='
Write-Host ''
Write-Host "App Name:     $AppName"
Write-Host "Version:      $version"
Write-Host "Commit:       $commit"
Write-Host "Platform:     $Platform"
Write-Host ''
Write-Host 'Directories:'
Write-Host "  Binary:     $BinDir"
Write-Host "  Dist:       $DistDir"
Write-Host ''
Write-Host "Use 'task --list' to see all available commands"
