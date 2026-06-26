<#
.SYNOPSIS
    Packages the already-built Windows binary (build/bin/yanta.exe) as an MSIX
    for Microsoft Store submission. Supplements the NSIS installer - it does not
    replace it.

.DESCRIPTION
    Wraps the unmodified yanta.exe as a packaged full-trust Win32 desktop app
    (Desktop Bridge). Flow:
      1. Resolve a 4-part Store version (X.Y.Z.0) from YANTA_VERSION / git tag.
         Non-release versions (dev-*, prereleases like v1.2.3-beta) are SKIPPED
         (exit 0) - MSIX is only produced for clean X.Y.Z release tags.
      2. Stage yanta.exe + generated PNG logo assets + a substituted manifest.
      3. Pack with the Windows SDK's MakeAppx.exe -> build/dist/yanta-windows-<ver>.msix.
      4. (optional, -SignForLocalTest) sign with a throwaway self-signed cert so
         the package can be installed locally for testing. The Store re-signs the
         submitted package, so the CI artifact is intentionally left UNSIGNED.

    Designed to degrade gracefully: a missing Windows SDK or a non-release
    version is a warning + exit 0, never a hard failure, so the NSIS release path
    is never blocked.

.NOTES
    Identity values come from your Partner Center reservation via env vars:
      MSIX_IDENTITY_NAME, MSIX_PUBLISHER, MSIX_PUBLISHER_DISPLAY
    If MSIX_PUBLISHER is unset, placeholder identity is used and the script warns
    loudly - that package is for local testing only and the Store will reject it.
#>
[CmdletBinding()]
param(
    [string]$BinDir   = "build/bin",
    [string]$DistDir  = "build/dist",
    [string]$MsixDir  = "build/windows/msix",
    [string]$AppName  = "yanta",
    [string]$IconPath = "build/appicon.png",
    [switch]$SignForLocalTest
)

$ErrorActionPreference = "Stop"

function Write-Section($msg) {
    Write-Host ""
    Write-Host "========================================"
    Write-Host $msg
    Write-Host "========================================"
}

Write-Section "Packaging Windows MSIX"

# --- 1. Resolve the 4-part Store version (X.Y.Z.0) --------------------------
# Precedence mirrors build/common Taskfile version:get, but ALWAYS strips a
# leading 'v' (CI sets YANTA_VERSION to the raw tag "v2.3.0") and rejects any
# version that is not a clean 3-part release.
function Resolve-MsixVersion {
    $raw = $env:YANTA_VERSION
    if ([string]::IsNullOrWhiteSpace($raw)) {
        try { $raw = (git describe --tags --abbrev=0 2>$null) } catch { $raw = $null }
    }
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    $v = $raw.Trim()
    if ($v.StartsWith("v")) { $v = $v.Substring(1) }
    # SKIP anything that isn't a clean X.Y.Z release: prerelease/build-metadata
    # tags (1.2.3-beta, 0.0.0-test.N) and dev-<commit> are intentionally not
    # packaged for the Store (matches how release.yml flags prereleases via '-').
    if ($v -notmatch '^\d+\.\d+\.\d+$') { return $null }
    return "$v.0"
}

$version = Resolve-MsixVersion
if (-not $version) {
    Write-Warning "MSIX: '$($env:YANTA_VERSION)' is not a clean X.Y.Z release tag - skipping MSIX packaging."
    exit 0
}
Write-Host "MSIX: package version = $version"

# --- 2. Identity (from Partner Center via env, else placeholder) ------------
$identityName     = if ($env:MSIX_IDENTITY_NAME)    { $env:MSIX_IDENTITY_NAME }    else { "OmarAhmed.YANTA" }
$publisher        = if ($env:MSIX_PUBLISHER)        { $env:MSIX_PUBLISHER }        else { "CN=Omar Ahmed" }
$publisherDisplay = if ($env:MSIX_PUBLISHER_DISPLAY){ $env:MSIX_PUBLISHER_DISPLAY }else { "Omar Ahmed" }
$usingPlaceholder = [string]::IsNullOrWhiteSpace($env:MSIX_PUBLISHER)
if ($usingPlaceholder) {
    Write-Warning "MSIX: using PLACEHOLDER identity (Publisher=$publisher)."
    Write-Warning "      This package is for LOCAL TESTING ONLY and will be REJECTED by the Store."
    Write-Warning "      Set MSIX_IDENTITY_NAME / MSIX_PUBLISHER / MSIX_PUBLISHER_DISPLAY from your"
    Write-Warning "      Partner Center reservation to produce a submittable package."
}

# --- 3. Verify the built binary --------------------------------------------
$exe = Join-Path $BinDir "$AppName.exe"
if (-not (Test-Path $exe)) {
    Write-Error "MSIX: $exe not found. Build it first (task build:win or task release:windows)."
    exit 1
}

# --- 4. Stage the package layout -------------------------------------------
$staged = Join-Path $MsixDir "staged"
if (Test-Path $staged) { Remove-Item -Recurse -Force $staged }
New-Item -ItemType Directory -Force -Path $staged | Out-Null
$assetsDir = Join-Path $staged "Assets"
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

Copy-Item $exe (Join-Path $staged "$AppName.exe") -Force
Write-Host "MSIX: staged $AppName.exe"

# --- 5. Generate PNG logo assets from the source app icon ------------------
if (-not (Test-Path $IconPath)) {
    Write-Error "MSIX: source icon '$IconPath' not found - cannot generate logo assets."
    exit 1
}
Add-Type -AssemblyName System.Drawing

function New-Logo {
    param([string]$SrcPath, [string]$OutPath, [int]$W, [int]$H)
    $src = [System.Drawing.Image]::FromFile((Resolve-Path $SrcPath))
    try {
        $bmp = New-Object System.Drawing.Bitmap($W, $H)
        $g   = [System.Drawing.Graphics]::FromImage($bmp)
        try {
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $g.Clear([System.Drawing.Color]::Transparent)
            # Fit the (square) source centered; wide tiles get letterboxed.
            $scale = [Math]::Min($W / $src.Width, $H / $src.Height)
            $dw = [int]($src.Width  * $scale)
            $dh = [int]($src.Height * $scale)
            $dx = [int](($W - $dw) / 2)
            $dy = [int](($H - $dh) / 2)
            $g.DrawImage($src, $dx, $dy, $dw, $dh)
            $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $g.Dispose(); $bmp.Dispose() }
    } finally { $src.Dispose() }
}

# Logo name -> [width, height]. Names must match AppxManifest.template.xml.
$logos = @{
    "Square44x44Logo.png"   = @(44, 44)
    "Square71x71Logo.png"   = @(71, 71)
    "Square150x150Logo.png" = @(150, 150)
    "Square310x310Logo.png" = @(310, 310)
    "Wide310x150Logo.png"   = @(310, 150)
    "StoreLogo.png"         = @(50, 50)
}
foreach ($name in $logos.Keys) {
    $dim = $logos[$name]
    New-Logo -SrcPath $IconPath -OutPath (Join-Path $assetsDir $name) -W $dim[0] -H $dim[1]
}
Write-Host "MSIX: generated $($logos.Count) logo assets from $IconPath"

# --- 6. Substitute the manifest template -----------------------------------
$templatePath = Join-Path $MsixDir "AppxManifest.template.xml"
if (-not (Test-Path $templatePath)) {
    Write-Error "MSIX: manifest template not found at $templatePath"
    exit 1
}
# Single-line .Replace() calls (Windows PowerShell 5.1 - used by `shell: powershell`
# on the runner - does not parse trailing-dot multiline method chains).
$manifest = Get-Content $templatePath -Raw
$manifest = $manifest.Replace("@VERSION@",           $version)
$manifest = $manifest.Replace("@IDENTITY_NAME@",     $identityName)
$manifest = $manifest.Replace("@PUBLISHER@",         $publisher)
$manifest = $manifest.Replace("@PUBLISHER_DISPLAY@", $publisherDisplay)
# UTF-8 without BOM (MakeAppx is picky about a BOM in the manifest).
$manifestOut = Join-Path $staged "AppxManifest.xml"
[System.IO.File]::WriteAllText($manifestOut, $manifest, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "MSIX: wrote AppxManifest.xml (Identity Name=$identityName, Publisher=$publisher)"

# --- 7. Locate the Windows SDK tools ---------------------------------------
function Find-SdkTool {
    param([string]$Name)
    $roots = @(
        (Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"),
        (Join-Path $env:ProgramFiles        "Windows Kits\10\bin")
    )
    foreach ($root in $roots) {
        if (Test-Path $root) {
            $hit = Get-ChildItem -Path $root -Recurse -Filter $Name -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -match '\\x64\\' } |
                Sort-Object FullName -Descending | Select-Object -First 1
            if ($hit) { return $hit.FullName }
        }
    }
    return $null
}

$makeappx = Find-SdkTool "makeappx.exe"
if (-not $makeappx) {
    # We only get here for a clean X.Y.Z release version (dev/prerelease tags
    # already returned above). On a release build the Windows SDK MUST be
    # present, so MSIX_REQUIRE_FOR_RELEASE=1 turns a missing SDK into a hard
    # failure rather than silently publishing a release with no MSIX.
    if ($env:MSIX_REQUIRE_FOR_RELEASE -eq '1') {
        Write-Error "MSIX: makeappx.exe (Windows SDK) not found, but this is a release build (MSIX_REQUIRE_FOR_RELEASE=1). Failing so the release is not published without an MSIX. Ensure the Windows SDK is installed on the runner."
        exit 1
    }
    Write-Warning "MSIX: makeappx.exe (Windows SDK) not found - skipping MSIX packaging."
    Write-Warning "      Install the Windows SDK to enable it: winget install Microsoft.WindowsSDK"
    exit 0
}
Write-Host "MSIX: using $makeappx"

# --- 8. Pack ----------------------------------------------------------------
New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
$msixOut = Join-Path $DistDir "$AppName-windows-$version.msix"
& $makeappx pack /d $staged /p $msixOut /o
if ($LASTEXITCODE -ne 0) {
    Write-Error "MSIX: makeappx pack failed (exit $LASTEXITCODE)"
    exit 1
}
Write-Host "MSIX: created $msixOut"

# --- 9. Optional local-test signing (DEV ONLY) -----------------------------
if ($SignForLocalTest) {
    Write-Section "Signing MSIX for LOCAL TEST (dev only)"
    $signtool = Find-SdkTool "signtool.exe"
    if (-not $signtool) {
        Write-Warning "signtool.exe not found - cannot sign. The unsigned .msix still exists for Store submission."
        exit 0
    }
    # The cert subject MUST equal Identity/@Publisher exactly, or install fails.
    $cert = New-SelfSignedCertificate `
        -Type Custom -Subject $publisher `
        -KeyUsage DigitalSignature -FriendlyName "YANTA MSIX Test (self-signed)" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
    $pfxPwd = ConvertTo-SecureString -String "yanta-test" -Force -AsPlainText
    $pfx    = Join-Path $MsixDir "yanta-test.pfx"
    Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $pfxPwd | Out-Null
    & $signtool sign /fd SHA256 /a /f $pfx /p "yanta-test" $msixOut
    if ($LASTEXITCODE -ne 0) { Write-Error "signtool sign failed (exit $LASTEXITCODE)"; exit 1 }
    Write-Host ""
    Write-Host "Signed for local test. To install locally, first trust the cert (admin PowerShell):"
    Write-Host "  Import-Certificate -FilePath '$pfx' -CertStoreLocation Cert:\LocalMachine\TrustedPeople"
    Write-Host "  (or import the .pfx) then: Add-AppxPackage '$msixOut'"
    Write-Warning "This self-signed signature is DEV-ONLY. Submit the UNSIGNED package to the Store."
}

Write-Host ""
Write-Host "MSIX packaging complete: $msixOut"
