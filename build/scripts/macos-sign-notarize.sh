#!/usr/bin/env bash
#
# macOS code-signing + notarization + DMG packaging for YANTA.
#
# Produces a distributable .dmg from a built yanta.app. When Developer ID
# signing secrets are present the app and dmg are signed with the Hardened
# Runtime, notarized via Apple's notary service, and the ticket is stapled so
# the .dmg opens on a clean Mac with no Gatekeeper warning (YANA-14, goal G4).
#
# When the secrets are absent (forks, PR builds, local dev without a cert) the
# script still produces an UNSIGNED .dmg and exits 0, printing a clear warning.
# An unsigned dmg WILL trip Gatekeeper — only a signed+notarized build meets the
# YANA-14 acceptance criteria.
#
# Required environment for a signed+notarized build:
#   MACOS_CERTIFICATE        base64-encoded Developer ID Application .p12
#   MACOS_CERTIFICATE_PWD    password for the .p12
#   MACOS_SIGN_IDENTITY      e.g. "Developer ID Application: ACME Inc (TEAMID123)"
#   MACOS_NOTARY_APPLE_ID    Apple ID email used for notarization
#   MACOS_NOTARY_TEAM_ID     10-char Apple Developer Team ID
#   MACOS_NOTARY_PASSWORD    app-specific password for that Apple ID
#
# Optional:
#   APP_PATH      path to the built .app           (default: build/bin/yanta.app)
#   DIST_DIR      output directory for the .dmg     (default: build/dist)
#   APP_NAME      base name for the dmg             (default: yanta)
#   ENTITLEMENTS  hardened-runtime entitlements     (default: build/darwin/entitlements.plist)
#   YANTA_VERSION version string used in dmg name   (default: derived from git)

set -euo pipefail

APP_PATH="${APP_PATH:-build/bin/yanta.app}"
DIST_DIR="${DIST_DIR:-build/dist}"
APP_NAME="${APP_NAME:-yanta}"
ENTITLEMENTS="${ENTITLEMENTS:-build/darwin/entitlements.plist}"

log()  { printf '\033[1;34m[macos-sign]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[macos-sign] WARNING:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[macos-sign] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
[ "$(uname)" = "Darwin" ] || die "must run on macOS (uname is $(uname))"
[ -d "$APP_PATH" ] || die "app bundle not found: $APP_PATH (run 'task release:macos' build step first)"
mkdir -p "$DIST_DIR"

# Derive version for the dmg filename.
if [ -z "${YANTA_VERSION:-}" ]; then
  if VERSION_TAG=$(git describe --tags --abbrev=0 2>/dev/null); then
    YANTA_VERSION="${VERSION_TAG#v}"
  else
    YANTA_VERSION="dev-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  fi
fi
DMG_PATH="${DIST_DIR}/${APP_NAME}-macos-${YANTA_VERSION}.dmg"
log "version: ${YANTA_VERSION}"
log "app:     ${APP_PATH}"
log "dmg:     ${DMG_PATH}"

# Decide whether we can sign. All five signing inputs must be present.
SIGN_ENABLED=1
for var in MACOS_CERTIFICATE MACOS_CERTIFICATE_PWD MACOS_SIGN_IDENTITY \
           MACOS_NOTARY_APPLE_ID MACOS_NOTARY_TEAM_ID MACOS_NOTARY_PASSWORD; do
  if [ -z "${!var:-}" ]; then
    SIGN_ENABLED=0
  fi
done

# ---------------------------------------------------------------------------
# Build the .dmg from the .app (with an /Applications drag-install symlink).
# ---------------------------------------------------------------------------
build_dmg() {
  log "building dmg image..."
  rm -f "$DMG_PATH"
  local staging
  staging="$(mktemp -d)"
  cp -R "$APP_PATH" "$staging/"
  ln -s /Applications "$staging/Applications"
  hdiutil create \
    -volname "YANTA" \
    -srcfolder "$staging" \
    -ov -format UDZO \
    "$DMG_PATH" >/dev/null
  rm -rf "$staging"
  log "dmg created: $DMG_PATH"
}

if [ "$SIGN_ENABLED" -eq 0 ]; then
  warn "signing secrets not set — producing an UNSIGNED dmg."
  warn "an unsigned dmg trips Gatekeeper; provision the MACOS_* secrets for a release build."
  build_dmg
  log "done (unsigned)."
  exit 0
fi

# ---------------------------------------------------------------------------
# Signed + notarized path.
# ---------------------------------------------------------------------------
require() { command -v "$1" >/dev/null 2>&1 || die "required tool not found: $1"; }
require codesign
require hdiutil
require xcrun
[ -f "$ENTITLEMENTS" ] || die "entitlements file not found: $ENTITLEMENTS"

# Import the Developer ID cert into a throwaway keychain so we never touch the
# user's login keychain and clean up automatically.
KEYCHAIN="$(mktemp -d)/yanta-signing.keychain-db"
KEYCHAIN_PWD="$(openssl rand -base64 24)"
CERT_FILE="$(mktemp).p12"

cleanup() {
  security delete-keychain "$KEYCHAIN" 2>/dev/null || true
  rm -f "$CERT_FILE"
}
trap cleanup EXIT

log "creating temporary signing keychain..."
security create-keychain -p "$KEYCHAIN_PWD" "$KEYCHAIN"
security set-keychain-settings -lut 3600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PWD" "$KEYCHAIN"

echo "$MACOS_CERTIFICATE" | base64 --decode > "$CERT_FILE"
security import "$CERT_FILE" -k "$KEYCHAIN" -P "$MACOS_CERTIFICATE_PWD" \
  -T /usr/bin/codesign -T /usr/bin/security
# Allow codesign to use the key without an interactive prompt.
security set-key-partition-list -S apple-tool:,apple:,codesign: \
  -s -k "$KEYCHAIN_PWD" "$KEYCHAIN" >/dev/null
# Make the temp keychain searchable alongside the defaults.
security list-keychains -d user -s "$KEYCHAIN" \
  $(security list-keychains -d user | sed s/\"//g)

log "signing app bundle with Hardened Runtime..."
# Sign nested mach-O content first (dylibs/helpers), then the bundle itself.
find "$APP_PATH/Contents" -type f \( -name "*.dylib" -o -perm -111 \) 2>/dev/null \
  | while IFS= read -r bin; do
      codesign --force --timestamp --options runtime \
        --keychain "$KEYCHAIN" \
        --sign "$MACOS_SIGN_IDENTITY" "$bin" 2>/dev/null || true
    done
codesign --force --timestamp --options runtime \
  --entitlements "$ENTITLEMENTS" \
  --keychain "$KEYCHAIN" \
  --sign "$MACOS_SIGN_IDENTITY" "$APP_PATH"

log "verifying app signature..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

build_dmg

log "signing dmg..."
codesign --force --timestamp \
  --keychain "$KEYCHAIN" \
  --sign "$MACOS_SIGN_IDENTITY" "$DMG_PATH"

log "submitting to Apple notary service (this can take a few minutes)..."
xcrun notarytool submit "$DMG_PATH" \
  --apple-id "$MACOS_NOTARY_APPLE_ID" \
  --team-id "$MACOS_NOTARY_TEAM_ID" \
  --password "$MACOS_NOTARY_PASSWORD" \
  --wait

log "stapling notarization ticket to dmg..."
xcrun stapler staple "$DMG_PATH"

log "final Gatekeeper assessment..."
xcrun stapler validate "$DMG_PATH"
spctl --assess --type open --context context:primary-signature --verbose=2 "$DMG_PATH" || \
  warn "spctl assessment returned non-zero (review above)."

log "done — signed, notarized & stapled: $DMG_PATH"
