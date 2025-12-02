#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

GITHUB_REPO="omarahm3/yanta"
INSTALL_DIR="/usr/local/bin"
TMP_DIR=$(mktemp -d)

cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_LIKE=$ID_LIKE
        OS_VERSION=$VERSION_ID
    else
        print_error "Cannot detect OS. /etc/os-release not found."
        exit 1
    fi
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_warning "Not running as root. Will attempt to use sudo for installation."
        SUDO="sudo"
    else
        SUDO=""
    fi
}

get_latest_version() {
    print_info "Fetching latest release version..."
    
    if command -v curl >/dev/null 2>&1; then
        VERSION=$(curl -sSL "https://api.github.com/repos/$GITHUB_REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"v([^"]+)".*/\1/')
    elif command -v wget >/dev/null 2>&1; then
        VERSION=$(wget -qO- "https://api.github.com/repos/$GITHUB_REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"v([^"]+)".*/\1/')
    else
        print_error "Neither curl nor wget found. Please install one of them."
        exit 1
    fi
    
    if [ -z "$VERSION" ]; then
        print_error "Failed to fetch latest version."
        exit 1
    fi
    
    print_info "Latest version: v$VERSION"
}

download_file() {
    local url=$1
    local output=$2
    
    if command -v curl >/dev/null 2>&1; then
        if ! curl -fsSL -o "$output" "$url"; then
            return 1
        fi
    elif command -v wget >/dev/null 2>&1; then
        if ! wget -qO "$output" "$url"; then
            return 1
        fi
    else
        print_error "Neither curl nor wget found."
        exit 1
    fi
    
    return 0
}

install_arch() {
    print_info "Installing Yanta for Arch Linux..."
    
    local missing_deps=()
    for dep in gtk3 webkit2gtk-4.1; do
        if ! pacman -Qi "$dep" >/dev/null 2>&1; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_info "Installing dependencies: ${missing_deps[*]}"
        $SUDO pacman -S --noconfirm "${missing_deps[@]}"
    fi
    
    local pkg_file="yanta-${VERSION}-1-x86_64.pkg.tar.zst"
    local download_url="https://github.com/$GITHUB_REPO/releases/download/v$VERSION/$pkg_file"
    
    print_info "Downloading $pkg_file..."
    if ! download_file "$download_url" "$TMP_DIR/$pkg_file"; then
        print_error "Failed to download package from $download_url"
        print_info "Please check if the release exists at: https://github.com/$GITHUB_REPO/releases/tag/v$VERSION"
        exit 1
    fi
    
    print_info "Installing package..."
    $SUDO pacman -U --noconfirm "$TMP_DIR/$pkg_file"
    
    print_success "Yanta installed successfully!"
}

install_ubuntu() {
    print_info "Installing Yanta for Ubuntu/Debian..."
    
    print_info "Updating package cache..."
    $SUDO apt-get update -qq
    
    local deps=(libgtk-3-0 libwebkit2gtk-4.1-0)
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! dpkg -l "$dep" >/dev/null 2>&1; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_info "Installing dependencies: ${missing_deps[*]}"
        $SUDO apt-get install -y "${missing_deps[@]}"
    fi
    
    local deb_file="yanta_${VERSION}_amd64.deb"
    local download_url="https://github.com/$GITHUB_REPO/releases/download/v$VERSION/$deb_file"
    
    print_info "Downloading $deb_file..."
    if ! download_file "$download_url" "$TMP_DIR/$deb_file"; then
        print_error "Failed to download package from $download_url"
        print_info "Please check if the release exists at: https://github.com/$GITHUB_REPO/releases/tag/v$VERSION"
        exit 1
    fi
    
    print_info "Installing package..."
    $SUDO dpkg -i "$TMP_DIR/$deb_file"
    
    $SUDO apt-get install -f -y
    
    print_success "Yanta installed successfully!"
}

main() {
    echo ""
    echo "╔═══════════════════════════════════════╗"
    echo "║   Yanta Installation Script           ║"
    echo "║   Yet Another Note Taking App         ║"
    echo "╚═══════════════════════════════════════╝"
    echo ""
    
    detect_os
    print_info "Detected OS: $OS"
    
    check_root
    get_latest_version
    
    if [[ "$OS" =~ ^(arch|manjaro|endeavouros|cachyos|artix|garuda)$ ]] || [[ "$OS_LIKE" == *"arch"* ]]; then
        install_arch
    elif [[ "$OS" =~ ^(ubuntu|debian|pop|linuxmint|elementary|zorin)$ ]] || [[ "$OS_LIKE" == *"debian"* ]] || [[ "$OS_LIKE" == *"ubuntu"* ]]; then
        install_ubuntu
    else
        print_error "Unsupported OS: $OS"
        print_info "Currently supported: Arch Linux (and derivatives), Ubuntu/Debian (and derivatives)"
        print_info "Please install manually from: https://github.com/$GITHUB_REPO/releases"
        exit 1
    fi
    
    echo ""
    print_success "Installation complete!"
    echo ""
}

main
