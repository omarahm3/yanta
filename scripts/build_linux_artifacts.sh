#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <version> <pkgrel>" >&2
  exit 1
fi

VERSION="$1"
PKGREL="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BIN="${REPO_ROOT}/build/bin/yanta"
DESKTOP_FILE="${REPO_ROOT}/yanta.desktop"
ICON_FILE="${REPO_ROOT}/build/appicon.png"
LICENSE_FILE="${REPO_ROOT}/LICENSE"

if [ ! -x "$BIN" ]; then
  echo "Binary not found at $BIN" >&2
  exit 1
fi

OUT_DIR_REL="build/dist"
OUT_DIR="${REPO_ROOT}/${OUT_DIR_REL}"
WORK_ROOT="${REPO_ROOT}/build/pkg"
TARBALL_STAGE="${WORK_ROOT}/tarball"
ARCH_STAGE="${WORK_ROOT}/arch"

rm -rf "$OUT_DIR" "$WORK_ROOT"
mkdir -p "$OUT_DIR"

# Tarball artifact
mkdir -p "$TARBALL_STAGE/yanta"
install -Dm755 "$BIN" "$TARBALL_STAGE/yanta/yanta"
install -Dm644 "$DESKTOP_FILE" "$TARBALL_STAGE/yanta/yanta.desktop"
install -Dm644 "$ICON_FILE" "$TARBALL_STAGE/yanta/yanta.png"

LINUX_TAR_REL="${OUT_DIR_REL}/yanta-linux.tar.gz"
LINUX_TAR="${REPO_ROOT}/${LINUX_TAR_REL}"
tar -C "$TARBALL_STAGE" -czf "$LINUX_TAR" yanta

# Arch package
mkdir -p "$ARCH_STAGE/usr/bin"
mkdir -p "$ARCH_STAGE/usr/share/applications"
mkdir -p "$ARCH_STAGE/usr/share/pixmaps"
mkdir -p "$ARCH_STAGE/usr/share/licenses/yanta"

install -Dm755 "$BIN" "$ARCH_STAGE/usr/bin/yanta"
install -Dm644 "$DESKTOP_FILE" "$ARCH_STAGE/usr/share/applications/yanta.desktop"
install -Dm644 "$ICON_FILE" "$ARCH_STAGE/usr/share/pixmaps/yanta.png"
install -Dm644 "$LICENSE_FILE" "$ARCH_STAGE/usr/share/licenses/yanta/LICENSE"

PKGVER="${VERSION}-${PKGREL}"
BUILDDATE="$(date +%s)"
SIZE=$(find "$ARCH_STAGE/usr" -type f -print0 | xargs -0 stat --format '%s' 2>/dev/null | awk '{sum += $1} END {print sum + 0}')

sed \
  -e "s/@PKGVER@/$PKGVER/" \
  -e "s/@BUILDDATE@/$BUILDDATE/" \
  -e "s/@SIZE@/$SIZE/" \
  "${REPO_ROOT}/packaging/arch/PKGINFO.tpl" > "$ARCH_STAGE/.PKGINFO"

sed \
  -e "s/@PKGVER@/$PKGVER/" \
  -e "s/@BUILDDATE@/$BUILDDATE/" \
  "${REPO_ROOT}/packaging/arch/BUILDINFO.tpl" > "$ARCH_STAGE/.BUILDINFO"

ARCH_PKG_REL="${OUT_DIR_REL}/yanta-${PKGVER}-x86_64.pkg.tar.gz"
ARCH_PKG="${REPO_ROOT}/${ARCH_PKG_REL}"
tar -C "$ARCH_STAGE" -czf "$ARCH_PKG" .

echo "Produced Linux tarball: $LINUX_TAR"
echo "Produced Arch package: $ARCH_PKG"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "linux_tar=$LINUX_TAR_REL" >> "$GITHUB_OUTPUT"
  echo "arch_pkg=$ARCH_PKG_REL" >> "$GITHUB_OUTPUT"
fi

echo "$LINUX_TAR"
echo "$ARCH_PKG"
