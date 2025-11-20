.PHONY: help bindings build test clean dev install-tools setup pre-commit

help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install-tools: ## Install required development tools
	@echo "Installing Wails v3..."
	go install github.com/wailsapp/wails/v3/cmd/wails3@latest
	@echo "Installing frontend dependencies..."
	cd frontend && npm ci
	@echo "✓ Tools installed"

setup: install-tools bindings ## Complete initial development setup
	@echo "✓ Setup complete - ready to develop!"

bindings: ## Generate TypeScript bindings from Go services
	@echo "Generating TypeScript bindings..."
	wails3 generate bindings
	@echo "✓ Bindings generated"

build: bindings ## Build the application (frontend + backend)
	@echo "Building frontend..."
	cd frontend && npm run build
	@echo "Building backend..."
	go build -o build/bin/yanta .
	@echo "✓ Build complete: build/bin/yanta"

test: ## Run all tests (Go + frontend)
	@echo "Running Go tests..."
	go test -v -race ./...
	@echo "Running frontend build test..."
	cd frontend && npm run build
	@echo "✓ All tests passed"

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	rm -rf build/bin build/dist build/pkg frontend/dist
	@echo "✓ Clean complete"

dev: bindings ## Start development mode with hot reload
	@echo "Starting Wails dev mode..."
	wails3 dev

pre-commit: bindings test ## Run pre-commit checks (bindings + tests)
	@echo "✓ Pre-commit checks passed"

# Git hook installation
install-hooks: ## Install git pre-commit hook
	@echo "Installing git hooks..."
	@mkdir -p .git/hooks
	@echo '#!/bin/bash' > .git/hooks/pre-commit
	@echo 'set -e' >> .git/hooks/pre-commit
	@echo 'echo "Running pre-commit checks..."' >> .git/hooks/pre-commit
	@echo 'make bindings' >> .git/hooks/pre-commit
	@echo 'git add frontend/bindings/' >> .git/hooks/pre-commit
	@echo 'echo "✓ Bindings updated"' >> .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "✓ Git hooks installed"
