#!/usr/bin/env bash

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_DIR="$SCRIPT_DIR/../node_modules/.vite"

if [ -d "$CACHE_DIR" ]; then
  rm -rf "$CACHE_DIR"
  echo "Vite cache cleared."
else
  echo "Vite cache is already empty."
fi
