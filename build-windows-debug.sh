#!/usr/bin/env bash
#
# Windows Debug Build Script - DEVELOPMENT ONLY
#
# Builds a Windows executable with debug symbols and verbose output
# for testing and development purposes.
#
# IMPORTANT: This is NOT for production releases!
# For releases, use the GitHub Actions workflow.
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_error "$1 is not installed"
        return 1
    fi
    print_success "$1 found"
    return 0
}

print_header "Windows Debug Build"
echo ""

# Check prerequisites
print_info "Checking prerequisites..."
check_command "wails" || { print_error "Install Wails: https://wails.io/docs/gettingstarted/installation"; exit 1; }
check_command "go" || { print_error "Install Go: https://go.dev/dl/"; exit 1; }
check_command "npm" || { print_error "Install Node.js: https://nodejs.org/"; exit 1; }

# Get build metadata
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION="dev-${COMMIT}"

print_info "Build metadata:"
echo "  Version: ${VERSION}"
echo "  Commit:  ${COMMIT}"
echo "  Date:    ${DATE}"
echo ""

# Install frontend dependencies
print_header "Installing Frontend Dependencies"
cd frontend
npm install
cd ..
print_success "Frontend dependencies installed"

# Build frontend
print_header "Building Frontend (Development Mode)"
cd frontend
npm run build
cd ..
print_success "Frontend build complete"

# Run Go tests
print_header "Running Go Tests"
if go test ./... -v; then
    print_success "All Go tests passed"
else
    print_error "Go tests failed"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create build output directory
BUILD_DIR="build/windows-debug"
mkdir -p "$BUILD_DIR"

print_header "Building Windows Debug Binary"
print_info "Platform: windows/amd64"
print_info "Mode: Debug (includes symbols)"
print_info "Output: ${BUILD_DIR}/"
echo ""

# Build with Wails
# -debug flag includes debug symbols and verbose output
# -devtools enables Chrome DevTools in the webview
# -windowsconsole shows console window on Windows
if wails build \
    -platform windows/amd64 \
    -debug \
    -devtools \
    -windowsconsole \
    -o "yanta-debug.exe" \
    -ldflags "-X main.version=${VERSION} -X main.commit=${COMMIT} -X main.date=${DATE}"; then

    print_success "Build completed successfully!"

    # Move to debug directory
    if [ -f "build/bin/yanta-debug.exe" ]; then
        mv build/bin/yanta-debug.exe "${BUILD_DIR}/"
        print_success "Binary moved to ${BUILD_DIR}/yanta-debug.exe"
    fi

    echo ""
    print_header "Build Summary"

    if [ -f "${BUILD_DIR}/yanta-debug.exe" ]; then
        SIZE=$(du -h "${BUILD_DIR}/yanta-debug.exe" | cut -f1)
        print_info "Binary size: ${SIZE}"
        print_info "Location: ${BUILD_DIR}/yanta-debug.exe"
        print_success "Build complete!"
    else
        print_error "Binary not found at expected location"
        exit 1
    fi
else
    print_error "Build failed!"
    exit 1
fi
