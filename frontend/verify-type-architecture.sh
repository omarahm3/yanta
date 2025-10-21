#!/bin/bash

# ============================================================================
# Type Architecture Verification Script
# ============================================================================
# This script verifies that the frontend is 100% decoupled from backend models
# and only uses frontend view types throughout the UI layer.
#
# Requirements:
# 1. No backend model imports in UI files (pages/, components/, hooks/, etc.)
# 2. Backend models ONLY in converter files (types/Project.ts, Entry.ts, Tag.ts)
# 3. All UI files use frontend types
# ============================================================================

echo "🔍 Verifying Type Architecture..."
echo ""

ERRORS=0

# ============================================================================
# Test 1: No backend model imports outside types/ folder
# ============================================================================
echo "📋 Test 1: Checking for backend model imports outside types/..."

FORBIDDEN_IMPORTS=$(grep -r "from.*wailsjs/go/models" src/ \
  --include="*.tsx" --include="*.ts" \
  --exclude-dir="types" 2>/dev/null)

if [ -n "$FORBIDDEN_IMPORTS" ]; then
  echo "❌ FAILED: Found backend model imports in UI files:"
  echo "$FORBIDDEN_IMPORTS"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ PASSED: No backend model imports in UI files"
fi

echo ""

# ============================================================================
# Test 2: Backend models only in converter files
# ============================================================================
echo "📋 Test 2: Verifying backend models only in converter files..."

CONVERTER_FILES=(
  "src/types/Project.ts"
  "src/types/Entry.ts"
  "src/types/Tag.ts"
)

MODEL_IMPORTS=$(grep -r "from.*wailsjs/go/models" src/types/ \
  --include="*.ts" 2>/dev/null)

EXPECTED_COUNT=3
ACTUAL_COUNT=$(echo "$MODEL_IMPORTS" | wc -l)

if [ "$ACTUAL_COUNT" -eq "$EXPECTED_COUNT" ]; then
  echo "✅ PASSED: Backend models only in converter files (${ACTUAL_COUNT}/3)"
else
  echo "❌ FAILED: Unexpected model imports count (${ACTUAL_COUNT}, expected ${EXPECTED_COUNT})"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# ============================================================================
# Test 3: No models.* usage in UI components
# ============================================================================
echo "📋 Test 3: Checking for direct backend model usage in UI..."

MODEL_USAGE=$(find src/pages src/components src/hooks -type f \( -name "*.tsx" -o -name "*.ts" \) -exec grep -l "models\." {} \; 2>/dev/null)

if [ -n "$MODEL_USAGE" ]; then
  echo "❌ FAILED: Found backend model usage in UI files:"
  echo "$MODEL_USAGE"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ PASSED: No direct backend model usage in UI"
fi

echo ""

# ============================================================================
# Test 4: Verify converter files exist and are properly structured
# ============================================================================
echo "📋 Test 4: Verifying converter file structure..."

for file in "${CONVERTER_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ FAILED: Missing converter file: $file"
    ERRORS=$((ERRORS + 1))
  else
    # Check for required converter functions
    FILENAME=$(basename "$file" .ts)
    case $FILENAME in
      "Project")
        grep -q "export function projectFromModel" "$file" && \
        grep -q "export function projectsFromModels" "$file" || {
          echo "❌ FAILED: Missing converter functions in $file"
          ERRORS=$((ERRORS + 1))
        }
        ;;
      "Entry")
        grep -q "export function entryFromModel" "$file" && \
        grep -q "export function entriesFromModels" "$file" || {
          echo "❌ FAILED: Missing converter functions in $file"
          ERRORS=$((ERRORS + 1))
        }
        ;;
      "Tag")
        grep -q "export function tagFromModel" "$file" && \
        grep -q "export function tagsFromModels" "$file" || {
          echo "❌ FAILED: Missing converter functions in $file"
          ERRORS=$((ERRORS + 1))
        }
        ;;
    esac
  fi
done

if [ $ERRORS -eq 0 ]; then
  echo "✅ PASSED: All converter files properly structured"
fi

echo ""

# ============================================================================
# Test 5: TypeScript compilation
# ============================================================================
echo "📋 Test 5: Verifying TypeScript compilation..."

cd "$(dirname "$0")"
npx tsc --noEmit 2>&1 > /tmp/tsc-output.txt

if [ $? -eq 0 ]; then
  echo "✅ PASSED: TypeScript compiles without errors"
else
  echo "❌ FAILED: TypeScript compilation errors:"
  cat /tmp/tsc-output.txt
  ERRORS=$((ERRORS + 1))
fi

echo ""

# ============================================================================
# Test 6: Verify frontend types are exported from yanta.ts
# ============================================================================
echo "📋 Test 6: Verifying type re-exports..."

INDEX_FILE="src/types/index.ts"

grep -q "export type { Project" "$INDEX_FILE" && \
grep -q "export type { Entry" "$INDEX_FILE" && \
grep -q "export type { Tag" "$INDEX_FILE" && \
grep -q "projectFromModel" "$INDEX_FILE" && \
grep -q "entryFromModel" "$INDEX_FILE" || {
  echo "❌ FAILED: Missing type re-exports in index.ts"
  ERRORS=$((ERRORS + 1))
}

if [ $ERRORS -eq 0 ]; then
  echo "✅ PASSED: All types properly re-exported"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "========================================="
echo "📊 Verification Summary"
echo "========================================="

if [ $ERRORS -eq 0 ]; then
  echo "✅ ALL TESTS PASSED!"
  echo ""
  echo "✨ Type architecture is 100% decoupled:"
  echo "   • Frontend uses only view types"
  echo "   • Backend models isolated to converters"
  echo "   • Clean separation of concerns"
  echo "   • TypeScript compiles successfully"
  exit 0
else
  echo "❌ $ERRORS TEST(S) FAILED"
  echo ""
  echo "Please fix the issues above to ensure proper type architecture."
  exit 1
fi
