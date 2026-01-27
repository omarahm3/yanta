# windows-verify-installer.ps1 - Verify Windows installer artifact exists

param(
  [string]$DistDir = "build/dist",
  [string]$InstallerName = "yanta-windows-installer.exe"
)

$ErrorActionPreference = "Stop"

$Installer = Join-Path $DistDir $InstallerName
if (Test-Path $Installer) {
  Write-Output "Windows installer verified"
  exit 0
}

Write-Error "Windows installer not found - run NSIS to generate it"
exit 1
