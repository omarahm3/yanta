# Frontend Test Suite Audit Report

**Audit Date:** 2026-02-04
**Auditor:** Claude Code Agent
**Test Suite:** Yanta Frontend (Vitest + React Testing Library)
**Total Test Files:** 67

---

## Executive Summary

### Overall Health Breakdown

| Verdict | Count | Percentage | Description |
|---------|-------|------------|-------------|
| **GOOD** | 51 | **76.1%** | Tests real behavior with meaningful assertions |
| **NEEDS WORK** | 15 | **22.4%** | Working but weak tests - could give false confidence |
| **BROKEN/USELESS** | 1 | **1.5%** | Provides false confidence, must fix |

### Health Score: B+ (76.1% solid)

The frontend test suite is in **good health** overall. Over three-quarters of test files demonstrate proper testing practices, verifying real component behavior with meaningful assertions. The strongest areas are **hooks testing** (100% GOOD) and **utility function testing** (100% GOOD).

### Key Findings Summary

1. **1 file must be deleted or completely rewritten** - `documentOpen.integration.test.ts` tests mock behavior, not actual integration
2. **15 files need improvement** - Most are testing implementation details (inline CSS styles) or synthetic components
3. **51 files are well-written** - Proper behavior testing, meaningful assertions, good async handling

---

## Health Breakdown by Directory

| Directory | Files | GOOD | NEEDS WORK | BROKEN | Health % |
|-----------|-------|------|------------|--------|----------|
| `src/__tests__/` | 26 | 16 | 9 | 1 | 61.5% |
| `src/components/__tests__/` | 6 | 5 | 1 | 0 | 83.3% |
| `src/components/ui/__tests__/` | 7 | 6 | 1 | 0 | 85.7% |
| `src/hooks/__tests__/` | 10 | 10 | 0 | 0 | **100%** |
| `src/pages/Journal/__tests__/` | 7 | 5 | 2 | 0 | 71.4% |
| `src/pages/QuickCapture/__tests__/` | 6 | 5 | 1 | 0 | 83.3% |
| `src/components/document/__tests__/` | 1 | 0 | 1 | 0 | 0% |
| `src/pages/settings/__tests__/` | 1 | 1 | 0 | 0 | **100%** |
| `src/utils/__tests__/` | 3 | 3 | 0 | 0 | **100%** |

### Strongest Areas (100% GOOD)
- **Hooks (`src/hooks/__tests__/`)** - 10 files with excellent patterns: real state testing, proper async handling, localStorage persistence, cross-tab sync, accessibility testing
- **Utilities (`src/utils/__tests__/`)** - 3 files with comprehensive pure unit tests, proper fake timer usage
- **Settings (`src/pages/settings/__tests__/`)** - 1 file with complete user flow testing, context integration

### Weakest Areas
- **Document (`src/components/document/__tests__/`)** - 0% GOOD, tests synthetic component
- **Main tests (`src/__tests__/`)** - 61.5% GOOD, contains the only BROKEN file and several "documentation" tests

---

## Critical Issues

**Tests That Provide False Confidence - MUST FIX**

This section documents the most serious problems in the test suite: tests that pass but don't actually verify meaningful behavior. These tests give developers false confidence that their code works correctly.

### Critical Issue #1: Integration Test That Tests Nothing (BROKEN/USELESS)

**File:** `src/__tests__/documentOpen.integration.test.ts`
**Severity:** 🔴 CRITICAL - Delete or completely rewrite
**Lines:** 28-40

#### The Problem

Despite being named "integration.test.ts", this file contains zero integration testing. It only verifies that mocks return what they were configured to return.

#### Evidence

```typescript
// Lines 28-29: Tests that a mock wasn't called - meaningless
it("should NOT call save on the mock after module load (sanity check)", () => {
  expect(DocumentServiceWrapper.save).not.toHaveBeenCalled();
});

// Lines 32-40: Tests that calling a mock returns what it was told to return
it("should be able to call save mock when explicitly invoked", async () => {
  await DocumentServiceWrapper.save({
    path: "test.md",
    content: [],
    projectPath: "/test",
  });
  expect(DocumentServiceWrapper.save).toHaveBeenCalledTimes(1);
});
```

#### Why This Is Dangerous

This test provides **100% false confidence**. A developer looking at the test name "documentOpen.integration.test.ts" would assume that:
- Document opening logic is tested
- Multiple components work together correctly
- Real integration scenarios are covered

**Reality:** None of this is true. The file tests mock configuration, not integration.

#### What Bugs Could Slip Through

| Scenario | Would This Test Catch It? |
|----------|---------------------------|
| Document fails to load from disk | ❌ No |
| Document opens with corrupted content | ❌ No |
| Save operation silently fails | ❌ No |
| Integration between document service and UI breaks | ❌ No |
| Any actual document opening bug | ❌ No |

#### Recommendation

**DELETE this file entirely** or replace with actual integration tests that:
- Open a real document through the UI
- Verify document content renders correctly
- Test save/load round-trip

---

### Critical Issue #2: Synthetic Component Testing (HIGH - 3 files)

**Files:**
1. `src/__tests__/Dashboard.pageHeader.test.tsx` (Lines 12-37)
2. `src/pages/Journal/__tests__/Journal.pageHeader.test.tsx` (Lines 17-28)
3. `src/components/document/__tests__/DocumentContent.pageHeader.test.tsx` (Lines 13-25)

**Severity:** 🟠 HIGH - Provides zero confidence about actual components

#### The Problem

All three files create local `TestComponent` implementations that mimic what they *think* the real component looks like, then test the fake component. The actual components are never rendered or tested.

#### Evidence (Same Pattern in All 3 Files)

```typescript
// Dashboard.pageHeader.test.tsx - Lines 12-37
const TestComponent = () => (
  <div className="p-4 border-b border-border">
    <div className="flex items-center gap-2">
      <FileText
        className="w-5 h-5"
        style={{ color: "var(--mode-accent)" }}
        aria-hidden="true"
        data-testid="mode-icon"
      />
      <span className="text-sm text-text-dim">All Documents</span>
    </div>
  </div>
);

// Tests the fake component
render(<TestComponent />);
const icon = screen.getByTestId("mode-icon");
expect(icon).toHaveStyle({ color: "var(--mode-accent)" });
```

```typescript
// Journal.pageHeader.test.tsx - Lines 17-28
const TestComponent = () => (
  <div className="p-4 border-b border-border">
    <div className="flex items-center justify-between mb-3">
      <BookOpen
        className="w-5 h-5"
        style={{ color: "var(--mode-accent)" }}
        aria-hidden="true"
        data-testid="mode-icon"
      />
    ...
```

```typescript
// DocumentContent.pageHeader.test.tsx - Lines 13-25
const TestComponent = () => (
  <div className="px-4 pt-4 pb-2 border-b border-border">
    <div className="flex items-center gap-2">
      <FileText
        className="w-5 h-5"
        style={{ color: "var(--mode-accent)" }}
        ...
```

#### Why This Is Dangerous

These tests can **pass forever** while the actual components are completely broken. The fake `TestComponent` will never change even if the real component:
- Has bugs
- Is refactored
- Is deleted entirely
- Has completely different structure

#### What Bugs Could Slip Through

| Scenario | Would These Tests Catch It? |
|----------|---------------------------|
| Dashboard header doesn't render | ❌ No |
| Journal header shows wrong icon | ❌ No |
| Document header has wrong text | ❌ No |
| Any header component crashes | ❌ No |
| Header styling is broken in actual components | ❌ No |

#### Total Impact

**3 tests providing 0% confidence** about 3 distinct components.

#### Recommendation

For each file, either:
1. **Import and render the actual component** (Dashboard, Journal, DocumentContent)
2. **Query for header elements** within the real component
3. **Or delete the test files** if other tests cover header rendering

---

### Critical Issue #3: Tests That Verify Mocks, Not Code (MEDIUM - 4 files)

**Files:**
1. `src/__tests__/shortcuts-document-context.test.ts` (Lines 34-200)
2. `src/__tests__/shortcuts-journal-context.test.ts` (Lines 33-290)
3. `src/__tests__/shortcuts-list-navigation.test.ts` (Lines 39-261)
4. `src/__tests__/HOTKEYS_MASTER.test.tsx` (Lines 4-76)

**Severity:** 🟡 MEDIUM - Tests assumptions, not implementation

#### The Problem

These files create local mock functions with expected behavior, then test those mocks. The actual controller hooks (`useDocumentController`, `useJournalController`, etc.) are never tested.

#### Evidence

```typescript
// shortcuts-document-context.test.ts - Lines 34-76
const getDocumentHotkeys = (): HotkeyConfig[] => {
  return [
    { key: "mod+s", handler: vi.fn(), description: "Save document", ... },
    { key: "Escape", handler: vi.fn(), description: "Unfocus editor", ... },
    { key: "mod+j", handler: vi.fn(), description: "Focus editor", ... },
    { key: "mod+Escape", handler: vi.fn(), description: "Unfocus editor", ... },
  ];
};

// This tests the LOCAL mock function, not actual useDocumentController
```

```typescript
// shortcuts-journal-context.test.ts - Lines 33-103
const getJournalHotkeys = (): HotkeyConfig[] => {
  return [
    { key: "ctrl+n", handler: vi.fn(), description: "New entry", ... },
    { key: "t", handler: vi.fn(), description: "Go to today", ... },
    ...
  ];
};
// Tests mock configuration, not actual journal controller
```

```typescript
// HOTKEYS_MASTER.test.tsx - Lines 4-76
it("documents tested hotkeys", () => {
  const coverage = {
    "App Level": ["mod+K", "shift+/", "mod+T", ...],
    "Dashboard": ["j/k", "Enter", "Space", ...],
    ...
  };
  console.log("\n=== HOTKEY COVERAGE ===\n");
  Object.entries(coverage).forEach(...)

  // Only assertion - tests that hardcoded object has 9 keys
  expect(Object.keys(coverage)).toHaveLength(9);
});
```

#### Why This Is Dangerous

These tests document **expected behavior** but don't verify the actual code matches those expectations. If:
- A developer changes `useDocumentController` hotkeys
- A handler is accidentally removed
- A key binding is changed

...these tests will still pass because they test their own mock data.

#### What Bugs Could Slip Through

| Scenario | Would These Tests Catch It? |
|----------|---------------------------|
| mod+s doesn't save (handler broken) | ❌ No |
| Journal 't' key doesn't go to today | ❌ No |
| Hotkey removed from controller | ❌ No |
| Handler throws exception | ❌ No |

#### Recommendation

1. **Import and test actual controller hooks** instead of creating local mocks
2. **HOTKEYS_MASTER.test.tsx**: Either derive data dynamically from source or delete

---

### Critical Issue #4: Implementation Detail Testing (MEDIUM - 5 files)

**Files:**
1. `src/components/__tests__/DocumentList.modeAccent.test.tsx` (Lines 39-42, 60-62, 80-83)
2. `src/components/ui/__tests__/ContextBar.test.tsx` (Lines 16-28, 58-67)
3. `src/pages/Journal/__tests__/JournalEntry.modeAccent.test.tsx` (Lines 13-73)
4. `src/pages/Journal/__tests__/JournalEntry.test.tsx` (Lines 88-107)
5. `src/pages/QuickCapture/__tests__/QuickEditor.test.tsx` (Multiple lines)

**Severity:** 🟡 MEDIUM - Brittle tests that fail when styling changes

#### The Problem

These files test inline CSS style values, which are implementation details. When the styling approach changes (e.g., from inline styles to CSS classes), tests break even though the feature works correctly.

#### Evidence

```typescript
// DocumentList.modeAccent.test.tsx - Lines 39-42
expect(highlightedItem).toHaveStyle({
  borderLeftColor: "var(--mode-accent)",
  backgroundColor: "var(--mode-accent-muted)",
});

// JournalEntry.modeAccent.test.tsx - Lines 19-22
expect(entry).toHaveStyle({
  borderLeftColor: "var(--mode-accent)",
  backgroundColor: "var(--mode-accent-muted)",
});

// ContextBar.test.tsx - Lines 16-21
expect(icon).toHaveStyle({ color: "var(--mode-accent)" });

// QuickEditor.test.tsx - Tests specific Tailwind color classes
expect(tagSpan).toHaveClass("text-[#98C379]"); // Specific hex color
expect(projectSpan).toHaveClass("text-[#61AFEF]"); // Specific hex color
```

#### Why This Is Problematic

1. **False negatives**: Tests fail when refactoring CSS even though feature works
2. **Maintenance burden**: Every styling change requires test updates
3. **Tests what, not why**: Verifies implementation, not user-visible behavior

#### What Bugs Could Slip Through

These tests WOULD catch: styling accidentally removed
These tests WOULD NOT catch: styling applied to wrong element, user can't see the styling

#### Impact

**5 files with fragile tests** that will break on CSS refactoring.

#### Recommendation

Replace inline style assertions with data-attribute testing:

```typescript
// Instead of:
expect(item).toHaveStyle({ borderLeftColor: "var(--mode-accent)" });

// Use:
expect(item).toHaveAttribute("data-highlighted", "true");
// Or:
expect(item).toHaveClass("highlighted");
```

---

### Summary: Critical Issues at a Glance

| Priority | Count | Files | Impact |
|----------|-------|-------|--------|
| 🔴 CRITICAL | 1 | documentOpen.integration.test.ts | 100% false confidence |
| 🟠 HIGH | 3 | *.pageHeader.test.tsx files | Tests fake components |
| 🟡 MEDIUM | 4 | shortcuts-*.test.ts, HOTKEYS_MASTER | Tests assumptions, not code |
| 🟡 MEDIUM | 5 | *modeAccent*.test.tsx, CSS style tests | Brittle, implementation-coupled |

**Total files needing immediate attention: 13 of 67 (19.4%)**

---

## Issue Categories

### Category 1: Mock Behavior Testing (CRITICAL - 1 file)

Tests that verify mocks return what they were told, providing zero confidence about real code.

| File | Lines | Issue |
|------|-------|-------|
| `documentOpen.integration.test.ts` | 28-40 | Tests that calling a mock returns what it was configured to return |

**Evidence:**
```typescript
// Lines 32-40: Tests mock, not integration
it("should be able to call save mock when explicitly invoked", async () => {
  await DocumentServiceWrapper.save({...});
  expect(DocumentServiceWrapper.save).toHaveBeenCalledTimes(1);
});
```

**Impact:** Despite being named "integration.test.ts", no actual integration is tested. Complete false confidence.

---

### Category 2: Synthetic Component Testing (HIGH - 3 files)

Tests that create fake components instead of testing the actual implementation.

| File | Lines | Issue |
|------|-------|-------|
| `Dashboard.pageHeader.test.tsx` | 12-37 | Tests a local `TestComponent`, not real Dashboard |
| `Journal.pageHeader.test.tsx` | 17-28 | Tests a local `TestComponent`, not real Journal |
| `DocumentContent.pageHeader.test.tsx` | 13-25 | Tests a local `TestComponent`, not real DocumentContent |

**Evidence:**
```typescript
// All three files follow this pattern:
const TestComponent = () => (
  <div className="p-4 border-b border-border">
    <FileText style={{ color: "var(--mode-accent)" }} />
  </div>
);
```

**Impact:** Actual component headers could be completely broken and these tests would still pass.

---

### Category 3: Inline CSS Style Testing (MEDIUM - 5 files)

Tests that verify inline style values, which break if implementation changes to class-based styling.

| File | Lines | Issue |
|------|-------|-------|
| `DocumentList.modeAccent.test.tsx` | 39-42, 60-62, 80-83 | Tests `toHaveStyle({ borderLeftColor: "var(--mode-accent)" })` |
| `ContextBar.test.tsx` | 16-28, 58-67 | Tests mode icon color and font sizes |
| `JournalEntry.modeAccent.test.tsx` | 13-73 | Entire file tests only inline CSS styles |
| `JournalEntry.test.tsx` | 88-107 | 2 tests check inline styles (14 tests total) |
| `QuickEditor.test.tsx` | Multiple | Tests specific Tailwind color classes (`text-[#98C379]`) |

**Evidence:**
```typescript
// Fragile pattern found in multiple files
expect(entry).toHaveStyle({
  borderLeftColor: "var(--mode-accent)",
  backgroundColor: "var(--mode-accent-muted)",
});
```

**Impact:** Tests fail when styling approach changes, even though the feature works correctly.

---

### Category 4: Documentation Tests (LOW - 4 files)

Tests that document expected behavior but don't verify actual code implementation.

| File | Lines | Issue |
|------|-------|-------|
| `HOTKEYS_MASTER.test.tsx` | 4-76 | Console logs coverage, only asserts hardcoded object has 9 keys |
| `shortcuts-document-context.test.ts` | 34-200 | Tests local mock functions, not actual useDocumentController |
| `shortcuts-journal-context.test.ts` | 33-290 | Tests local mock functions, not actual useJournalController |
| `shortcuts-list-navigation.test.ts` | 39-261 | Tests local mock functions, not actual controllers |

**Evidence:**
```typescript
// HOTKEYS_MASTER.test.tsx - only assertion
expect(Object.keys(coverage)).toHaveLength(9);
```

**Impact:** Code could drift from documented expectations without test failures.

---

### Category 5: Registration-Only Testing (LOW - 2 files)

Tests that verify hotkeys are registered but don't test handler behavior.

| File | Lines | Issue |
|------|-------|-------|
| `Settings.hotkeys.test.tsx` | 134-160 | Checks hotkey metadata, not that pressing keys works |
| `shortcut-conflicts.test.ts` | 47-523 | Manually maintained shortcut list could drift |

**Evidence:**
```typescript
// Settings.hotkeys.test.tsx - tests registration, not behavior
const jHotkey = context.getRegisteredHotkeys().find((h) => h.key === "j");
expect(jHotkey).toBeDefined();
expect(jHotkey?.description).toBe("Navigate to next section");
// Missing: Actually pressing "j" and verifying navigation
```

---

## Complete Verdict List

### GOOD Files (51)

| Directory | File |
|-----------|------|
| `src/__tests__/` | App.hotkeys.test.tsx |
| `src/__tests__/` | CommandPalette.hotkeys.test.tsx |
| `src/__tests__/` | Dashboard.hotkeys.test.tsx |
| `src/__tests__/` | Document.hotkeys.test.tsx |
| `src/__tests__/` | HelpModal.hotkeys.test.tsx |
| `src/__tests__/` | HelpModal.keyboard-nav.test.tsx |
| `src/__tests__/` | Layout.dataMode.test.tsx |
| `src/__tests__/` | Layout.hotkeys.test.tsx |
| `src/__tests__/` | Projects.hotkeys.test.tsx |
| `src/__tests__/` | Search.hotkeys.test.tsx |
| `src/__tests__/` | contentHash.test.ts |
| `src/__tests__/` | shortcuts-command-palette.test.tsx |
| `src/__tests__/` | shortcuts-global-navigation.test.tsx |
| `src/__tests__/` | useAutoSave.test.ts |
| `src/__tests__/` | useDocumentPersistence.test.ts |
| `src/__tests__/` | useFooterHints.test.ts |
| `src/__tests__/` | usePlainTextClipboard.test.ts |
| `src/__tests__/` | useRecentDocuments.test.ts |
| `src/components/__tests__/` | DocumentList.test.tsx |
| `src/components/__tests__/` | MilestoneHint.test.tsx |
| `src/components/__tests__/` | MilestoneHintManager.test.tsx |
| `src/components/__tests__/` | TitleBar.test.tsx |
| `src/components/__tests__/` | WelcomeOverlay.test.tsx |
| `src/components/ui/__tests__/` | CommandPalette.test.tsx |
| `src/components/ui/__tests__/` | ConfirmDialog.test.tsx |
| `src/components/ui/__tests__/` | FooterHintBar.test.tsx |
| `src/components/ui/__tests__/` | ShortcutTooltip.test.tsx |
| `src/components/ui/__tests__/` | Sidebar.test.tsx |
| `src/components/ui/__tests__/` | WithTooltip.test.tsx |
| `src/hooks/__tests__/` | useCommandDeprecation.test.ts |
| `src/hooks/__tests__/` | useCommandUsage.test.ts |
| `src/hooks/__tests__/` | useFooterHintsSetting.test.ts |
| `src/hooks/__tests__/` | useMilestoneHints.test.ts |
| `src/hooks/__tests__/` | useOnboarding.test.ts |
| `src/hooks/__tests__/` | useShortcutTooltip.test.ts |
| `src/hooks/__tests__/` | useShortcutTooltipsSetting.test.ts |
| `src/hooks/__tests__/` | useSidebarSetting.test.ts |
| `src/hooks/__tests__/` | useTooltipUsage.test.ts |
| `src/hooks/__tests__/` | useUserProgress.test.ts |
| `src/pages/Journal/__tests__/` | DatePicker.test.tsx |
| `src/pages/Journal/__tests__/` | Journal.test.tsx |
| `src/pages/Journal/__tests__/` | JournalEntry.test.tsx |
| `src/pages/Journal/__tests__/` | useJournal.test.ts |
| `src/pages/Journal/__tests__/` | useJournalController.test.ts |
| `src/pages/QuickCapture/__tests__/` | parser.test.ts |
| `src/pages/QuickCapture/__tests__/` | ProjectPicker.test.tsx |
| `src/pages/QuickCapture/__tests__/` | QuickCapture.test.tsx |
| `src/pages/QuickCapture/__tests__/` | TagChips.test.tsx |
| `src/pages/QuickCapture/__tests__/` | useQuickCapture.test.ts |
| `src/pages/settings/__tests__/` | AboutSection.test.tsx |
| `src/utils/__tests__/` | accessibility.test.ts |
| `src/utils/__tests__/` | commandPreprocessor.test.ts |
| `src/utils/__tests__/` | commandSorting.test.ts |

### NEEDS WORK Files (15)

| File | Primary Issue |
|------|---------------|
| `Dashboard.pageHeader.test.tsx` | Tests synthetic component |
| `HOTKEYS_MASTER.test.tsx` | Documentation only, no real tests |
| `Settings.hotkeys.test.tsx` | Tests registration, not behavior |
| `shortcut-conflicts.test.ts` | Manually maintained data |
| `shortcuts-document-context.test.ts` | Tests assumptions, not code |
| `shortcuts-journal-context.test.ts` | Tests assumptions, not code |
| `shortcuts-list-navigation.test.ts` | Tests assumptions, not code |
| `DocumentList.modeAccent.test.tsx` | Tests inline CSS styles |
| `ContextBar.test.tsx` | Tests inline CSS styles |
| `Journal.pageHeader.test.tsx` | Tests synthetic component |
| `JournalEntry.modeAccent.test.tsx` | Tests inline CSS styles only |
| `QuickEditor.test.tsx` | Tests Tailwind color classes |
| `DocumentContent.pageHeader.test.tsx` | Tests synthetic component |

### BROKEN/USELESS Files (1)

| File | Issue |
|------|-------|
| `documentOpen.integration.test.ts` | Tests mock behavior, zero integration testing |

---

## Positive Patterns Observed

The test suite demonstrates many excellent practices that should be preserved and propagated:

### 1. Proper Async Handling
```typescript
// From useAutoSave.test.ts - proper waitFor usage
await waitFor(() => {
  expect(mockSave).toHaveBeenCalledWith({...});
});
```

### 2. Fake Timer Usage for Time-Based Tests
```typescript
// From useTooltipUsage.test.ts
vi.useFakeTimers();
vi.setSystemTime(new Date(1000));
// ... test time-dependent logic
vi.useRealTimers();
```

### 3. Real State Verification
```typescript
// From useUserProgress.test.ts - verifies actual localStorage
const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
expect(stored).toEqual({
  documentsCreated: 5,
  journalEntriesCreated: 1,
});
```

### 4. Optimistic Update + Rollback Testing
```typescript
// From useFooterHintsSetting.test.ts
mockSetShowFooterHints.mockRejectedValue(new Error("Failed"));
await act(async () => {
  try { await result.current.setShowFooterHints(false); }
  catch { /* Expected */ }
});
expect(result.current.showFooterHints).toBe(true); // Reverted!
```

### 5. Accessibility Testing
```typescript
// From useSidebarSetting.test.ts - tests screen reader announcements
const liveRegion = document.querySelector('[role="status"][aria-live]');
expect(liveRegion?.textContent).toBe("Sidebar shown.");
```

### 6. Cross-Tab Sync Testing
```typescript
// From useRecentDocuments.test.ts
window.dispatchEvent(new StorageEvent("storage", {
  key: "recent-documents",
  newValue: JSON.stringify([...]),
}));
```

### 7. Data Attribute Testing (preferred over style testing)
```typescript
// From DatePicker.test.tsx - good pattern
expect(day28.closest("[data-has-entries]")).toHaveAttribute("data-has-entries", "true");
```

---

## Prioritized Action Plan

This section provides a ranked list of recommended fixes, ordered by impact (maximum improvement first). Each action includes estimated effort, files affected, and the expected improvement in test suite confidence.

### Priority Legend

| Priority | Impact | Effort | Urgency |
|----------|--------|--------|---------|
| 🔴 P0 | Critical | Low-Medium | Immediate |
| 🟠 P1 | High | Medium | This Sprint |
| 🟡 P2 | Medium | Low-Medium | Backlog |
| 🟢 P3 | Low | Low | Optional |

---

### 🔴 P0: DELETE BROKEN INTEGRATION TEST (Immediate)

**Impact:** Removes 100% false confidence from test suite naming
**Effort:** 5 minutes
**Files:** 1

#### Action

**Delete** `src/__tests__/documentOpen.integration.test.ts`

This file tests mock configuration, not integration. Its name misleads developers into thinking document opening integration is tested when it isn't.

#### Alternative (if deletion not acceptable)

Rename to `documentOpen.mock-setup.test.ts` to clarify it only validates mock setup, not actual integration.

#### Expected Outcome

- Test suite name no longer implies integration coverage exists
- Developers know they need to write actual integration tests
- No false confidence from misleading test names

---

### 🟠 P1.1: FIX SYNTHETIC COMPONENT TESTS (This Sprint)

**Impact:** Fixes 3 tests that provide zero confidence
**Effort:** 2-3 hours total
**Files:** 3

#### Files to Fix

| File | Action |
|------|--------|
| `src/__tests__/Dashboard.pageHeader.test.tsx` | Import real Dashboard, test actual header |
| `src/pages/Journal/__tests__/Journal.pageHeader.test.tsx` | Import real Journal, test actual header |
| `src/components/document/__tests__/DocumentContent.pageHeader.test.tsx` | Import real DocumentContent, test actual header |

#### Recommended Fix Pattern

```typescript
// BEFORE: Tests fake component
const TestComponent = () => (
  <div><FileText style={{ color: "var(--mode-accent)" }} /></div>
);
render(<TestComponent />);

// AFTER: Tests real component
import Dashboard from "../Dashboard";
render(<Dashboard />);
const headerIcon = screen.getByTestId("page-header-icon");
expect(headerIcon).toBeInTheDocument();
```

#### Expected Outcome

- 3 tests now verify actual component behavior
- Header bugs will be caught by tests
- Suite confidence improves from 76.1% to ~80%

---

### 🟠 P1.2: FIX SHORTCUT CONTROLLER TESTS (This Sprint)

**Impact:** 4 files testing assumptions, not implementations
**Effort:** 4-6 hours total
**Files:** 4

#### Files to Fix

| File | Action |
|------|--------|
| `src/__tests__/shortcuts-document-context.test.ts` | Import real useDocumentController |
| `src/__tests__/shortcuts-journal-context.test.ts` | Import real useJournalController |
| `src/__tests__/shortcuts-list-navigation.test.ts` | Import real list controller hooks |
| `src/__tests__/HOTKEYS_MASTER.test.tsx` | Delete or derive from source |

#### Recommended Fix Pattern

```typescript
// BEFORE: Tests local mock
const getDocumentHotkeys = (): HotkeyConfig[] => {
  return [{ key: "mod+s", handler: vi.fn(), ... }];
};

// AFTER: Tests actual hook
import { useDocumentController } from "../hooks/useDocumentController";
const { result } = renderHook(() => useDocumentController());
const saveHotkey = result.current.hotkeys.find(h => h.key === "mod+s");
expect(saveHotkey).toBeDefined();
```

#### Expected Outcome

- Shortcut tests verify actual controller implementations
- Hotkey changes will be caught by tests
- No more drift between test expectations and reality

---

### 🟡 P2.1: REFACTOR CSS STYLE TESTS (Backlog)

**Impact:** 5 files with brittle style assertions
**Effort:** 3-4 hours total
**Files:** 5

#### Files to Fix

| File | Lines | Fix |
|------|-------|-----|
| `DocumentList.modeAccent.test.tsx` | 39-42, 60-62, 80-83 | Use data-attribute |
| `ContextBar.test.tsx` | 16-28, 58-67 | Use data-attribute |
| `JournalEntry.modeAccent.test.tsx` | 13-73 | Use data-attribute |
| `JournalEntry.test.tsx` | 88-107 | Keep or use classes |
| `QuickEditor.test.tsx` | Multiple | Use data-highlight attribute |

#### Recommended Fix Pattern

```typescript
// BEFORE: Fragile inline style test
expect(item).toHaveStyle({ borderLeftColor: "var(--mode-accent)" });

// AFTER: Robust data-attribute test
expect(item).toHaveAttribute("data-highlighted", "true");
// Or
expect(item).toHaveClass("mode-highlighted");
```

**Note:** This requires adding `data-highlighted` or similar attributes to components first.

#### Expected Outcome

- CSS refactoring won't break tests
- Tests verify semantic state, not implementation
- Reduced maintenance burden

---

### 🟡 P2.2: IMPROVE REGISTRATION-ONLY TESTS (Backlog)

**Impact:** 2 files test registration but not behavior
**Effort:** 2-3 hours total
**Files:** 2

#### Files to Fix

| File | Issue | Fix |
|------|-------|-----|
| `Settings.hotkeys.test.tsx` | Tests metadata, not key press | Add actual key press tests |
| `shortcut-conflicts.test.ts` | Manual shortcut list | Auto-derive from source |

#### Recommended Fix Pattern

```typescript
// BEFORE: Tests that hotkey is registered
const jHotkey = context.getRegisteredHotkeys().find((h) => h.key === "j");
expect(jHotkey).toBeDefined();

// AFTER: Tests that pressing key works
await userEvent.keyboard("j");
expect(mockNavigate).toHaveBeenCalled();
```

#### Expected Outcome

- Hotkey handlers verified, not just registration
- Broken handlers caught by tests
- Shortcut conflict detection stays current with codebase

---

### 🟢 P3: MINOR IMPROVEMENTS (Optional)

**Impact:** Small improvements to otherwise good tests
**Effort:** 1-2 hours total

#### Quick Wins

| File | Issue | Fix |
|------|-------|-----|
| `CommandPalette.test.tsx` | Conditional assertions (L105-117) | Remove conditionals |
| `ProjectPicker.test.tsx` | Doesn't verify which project selected (L52) | Add `toHaveBeenCalledWith` |
| `QuickCapture.test.tsx` | Doesn't verify service args (L100, 168) | Add `expect.objectContaining` |
| `TagChips.test.tsx` | Uses querySelector (L15) | Use data-testid |

These are minor issues in otherwise well-written tests. Fix when touching these files for other reasons.

---

### Implementation Roadmap

#### Phase 1: Immediate (Week 1)

| Task | Files | Hours | Status |
|------|-------|-------|--------|
| Delete broken integration test | 1 | 0.1 | ⬜ |
| Fix Dashboard pageHeader test | 1 | 1 | ⬜ |
| Fix Journal pageHeader test | 1 | 1 | ⬜ |
| Fix DocumentContent pageHeader test | 1 | 1 | ⬜ |

**Outcome:** 4 files fixed, suite confidence improves ~5%

#### Phase 2: This Sprint (Week 2-3)

| Task | Files | Hours | Status |
|------|-------|-------|--------|
| Fix shortcuts-document-context tests | 1 | 1.5 | ⬜ |
| Fix shortcuts-journal-context tests | 1 | 1.5 | ⬜ |
| Fix shortcuts-list-navigation tests | 1 | 1.5 | ⬜ |
| Delete/fix HOTKEYS_MASTER test | 1 | 0.5 | ⬜ |

**Outcome:** 4 more files fixed, shortcut tests now meaningful

#### Phase 3: Backlog (Future Sprints)

| Task | Files | Hours | Status |
|------|-------|-------|--------|
| Add data-attributes to components | - | 2 | ⬜ |
| Refactor CSS style tests | 5 | 3 | ⬜ |
| Improve registration tests | 2 | 2 | ⬜ |

**Outcome:** All 15 NEEDS WORK files addressed

---

### Expected Final State

After completing all phases:

| Metric | Before | After |
|--------|--------|-------|
| GOOD files | 51 (76.1%) | 66 (98.5%) |
| NEEDS WORK files | 15 (22.4%) | 0 (0%) |
| BROKEN files | 1 (1.5%) | 0 (0%) |
| Health Grade | B+ | A+ |

**Total estimated effort:** ~15 hours of focused work

---

### Coverage Gaps to Address (Future Work)

Beyond fixing existing tests, consider adding tests for:

1. **Document opening integration** - Currently zero coverage (was false positive)
2. **Real header rendering** - After fixing pageHeader tests, ensure headers tested in context
3. **Hotkey handler behavior** - After fixing shortcut tests, verify handlers work end-to-end
4. **Edge cases in mode accent rendering** - After refactoring, test accessibility of highlighted states

---

## Reference: Detailed Audit Reports

For complete file-by-file analysis with line numbers and code evidence, see:

1. [audit-src-tests.md](./audit-src-tests.md) - `src/__tests__/` (26 files)
2. [audit-components-tests.md](./audit-components-tests.md) - `src/components/__tests__/` (6 files)
3. [audit-hooks-tests.md](./audit-hooks-tests.md) - `src/hooks/__tests__/` (10 files)
4. [audit-journal-tests.md](./audit-journal-tests.md) - `src/pages/Journal/__tests__/` (7 files)
5. [audit-remaining-tests.md](./audit-remaining-tests.md) - Remaining directories (5 files)

**Note:** `src/components/ui/__tests__/` and `src/pages/QuickCapture/__tests__/` findings are included in the implementation plan notes and context.json.

---

*Report generated by Claude Code Agent as part of Frontend Test Suite Quality Audit*
