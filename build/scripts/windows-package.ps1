# windows-package.ps1 - Package Windows release artifacts
# Cross-platform: This script is only used on Windows, Unix uses inline shell commands

param(
    [string]$BinDir = "build/bin",
    [string]$DistDir = "build/dist",
    [string]$AppName = "yanta"
)

$ErrorActionPreference = "Stop"

# Ensure dist directory exists
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
}

# Copy portable exe
$Portable = Join-Path $BinDir "$AppName.exe"
if (-not (Test-Path $Portable)) {
    Write-Error "Portable binary not found at $Portable"
    exit 1
}
Copy-Item $Portable (Join-Path $DistDir "yanta-windows-portable.exe")
Write-Output "Copied portable exe"

# Find and copy installer
Write-Output "Looking for installer in $BinDir..."
$Installer = Get-ChildItem -Path $BinDir -Filter "*installer*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($Installer) {
    Copy-Item $Installer.FullName (Join-Path $DistDir "yanta-windows-installer.exe")
    Write-Output "Copied installer exe"
} else {
    Write-Warning "Installer not found - may need to run NSIS separately"
}
