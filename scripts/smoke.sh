#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Running smoke tests in $ROOT_DIR"
echo "==> Step 1/4: backend tests"
task test:backend

echo "==> Step 2/4: build"
task build

echo "==> Step 3/4: release artifacts"
task release:all

echo "==> Step 4/4: verify artifacts"
task release:verify

echo "==> Smoke tests complete"
