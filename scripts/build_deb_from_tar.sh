#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <tarball> <version>" >&2
  exit 1
fi

TARBALL="$1"
VERSION="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

DIST_DIR="${REPO_ROOT}/build/dist"
STAGE_ROOT="${REPO_ROOT}/build/pkg/deb"
EXTRACT_DIR="$STAGE_ROOT/extracted"
DEB_ROOT="$STAGE_ROOT/root"

rm -rf "$STAGE_ROOT"
mkdir -p "$EXTRACT_DIR" "$DEB_ROOT"

tar -xzf "$TARBALL" -C "$EXTRACT_DIR"
SOURCE_DIR="$EXTRACT_DIR/yanta"

install -Dm755 "$SOURCE_DIR/yanta" "$DEB_ROOT/usr/bin/yanta"
install -Dm644 "$SOURCE_DIR/yanta.desktop" "$DEB_ROOT/usr/share/applications/yanta.desktop"
install -Dm644 "$SOURCE_DIR/yanta.png" "$DEB_ROOT/usr/share/pixmaps/yanta.png"

mkdir -p "$DEB_ROOT/DEBIAN"
sed "s/@VERSION@/$VERSION/" "${REPO_ROOT}/packaging/debian/control.tpl" > "$DEB_ROOT/DEBIAN/control"

mkdir -p "$DIST_DIR"
DEB_PATH="$DIST_DIR/yanta_${VERSION}_amd64.deb"
dpkg-deb --build --root-owner-group "$DEB_ROOT" "$DEB_PATH"

echo "Produced Debian package: $DEB_PATH"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "deb=$DEB_PATH" >> "$GITHUB_OUTPUT"
fi

echo "$DEB_PATH"
