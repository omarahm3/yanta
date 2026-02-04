# Audit Report: src/__tests__/ Directory (26 files)

## Summary

| Verdict | Count | Percentage |
|---------|-------|------------|
| GOOD | 16 | 61.5% |
| NEEDS WORK | 9 | 34.6% |
| BROKEN/USELESS | 1 | 3.8% |

---

## File-by-File Audit

### 1. App.hotkeys.test.tsx
**Verdict: GOOD**

Tests real hotkey registration and handling through the HotkeyProvider context.

**Strengths:**
- Tests actual App component with real HotkeyProvider
- Verifies hotkey handlers trigger expected side effects (lines 111-126)
- Uses `waitFor` properly for async operations

**Minor Issues:**
- Heavy mocking (lines 7-100), but appropriate for this integration test

**Risk Assessment:** Low risk - would catch bugs in hotkey registration

---

### 2. CommandPalette.hotkeys.test.tsx
**Verdict: GOOD**

Comprehensive testing of command palette keyboard interactions.

**Strengths:**
- Tests real DOM interactions with proper `fireEvent` usage
- Verifies navigation state through `data-selected` attributes (lines 76-86)
- Tests wrap-around behavior and command execution

**Risk Assessment:** Low risk - thorough coverage of keyboard navigation

---

### 3. Dashboard.hotkeys.test.tsx
**Verdict: GOOD**

Tests dashboard hotkeys through the HotkeyProvider context.

**Strengths:**
- Verifies actual function calls with correct arguments (lines 181, 226-229, 244-246)
- Tests selection, navigation, archive/restore behavior
- Proper async handling with `act` and `waitFor`

**Risk Assessment:** Low risk

---

### 4. Dashboard.pageHeader.test.tsx
**Verdict: NEEDS WORK**

**Issues Found:**
- **Lines 12-37:** Creates a local TestComponent instead of testing the real Dashboard page header
  ```typescript
  const TestComponent = () => (
    <div className="p-4 border-b border-border">
      <div className="flex items-center gap-2">
        <FileText ... />
  ```
- Tests styling on a hand-crafted component, not the actual implementation
- Could pass while real component is broken

**Risk Assessment:** Medium - bugs in actual Dashboard header wouldn't be caught

**Recommended Fix:** Import and render the actual Dashboard component, then query for the header elements

---

### 5. Document.hotkeys.test.tsx
**Verdict: GOOD**

Tests document page hotkeys for save, escape, unfocus, and focus actions.

**Strengths:**
- Verifies mock functions are called when hotkeys triggered (lines 157-167)
- Tests all 4 core document hotkeys
- Proper cleanup in `beforeEach`

**Risk Assessment:** Low risk

---

### 6. HelpModal.hotkeys.test.tsx
**Verdict: GOOD**

Tests help modal keyboard shortcuts.

**Strengths:**
- Tests Escape and ? key close behavior (lines 34-46)
- Uses real `fireEvent.keyDown` on document

**Risk Assessment:** Low risk

---

### 7. HelpModal.keyboard-nav.test.tsx
**Verdict: GOOD**

Tests accessibility and keyboard navigation in help modal.

**Strengths:**
- Tests ARIA attributes (aria-expanded, aria-controls)
- Tests search input behavior with Escape
- Tests section toggle with Enter/Space

**Risk Assessment:** Low risk

---

### 8. HOTKEYS_MASTER.test.tsx
**Verdict: NEEDS WORK**

**Issues Found:**
- **Lines 4-76:** This file just documents coverage, doesn't test actual behavior
  ```typescript
  it("documents tested hotkeys", () => {
    const coverage = { ... };
    console.log("\n=== HOTKEY COVERAGE ===\n");
    Object.entries(coverage).forEach(...)
    expect(Object.keys(coverage)).toHaveLength(9);
  });
  ```
- Only assertion is that the hardcoded object has 9 keys
- Provides false confidence - could become stale

**Risk Assessment:** Medium - gives false sense of coverage without testing anything real

**Recommended Fix:** Either remove this file or convert to actual integration tests that verify hotkey counts dynamically

---

### 9. Layout.dataMode.test.tsx
**Verdict: GOOD**

Tests data-mode attribute assignment based on page context.

**Strengths:**
- Tests actual Layout component rendering
- Verifies correct data-mode values for all pages (lines 72-112)
- Clear, focused tests

**Risk Assessment:** Low risk

---

### 10. Layout.hotkeys.test.tsx
**Verdict: GOOD**

Tests layout-level hotkeys (sidebar toggle).

**Strengths:**
- Tests actual hotkey registration and handler execution
- Verifies mockToggleSidebar is called (line 115)

**Risk Assessment:** Low risk

---

### 11. Projects.hotkeys.test.tsx
**Verdict: GOOD**

Tests projects page hotkeys for navigation and commands.

**Strengths:**
- Tests j/k navigation with state verification (lines 122-136)
- Tests project switching with Enter (lines 154-161)
- Tests command queuing (lines 163-196)

**Risk Assessment:** Low risk

---

### 12. Search.hotkeys.test.tsx
**Verdict: GOOD**

Tests search page keyboard interactions.

**Strengths:**
- Tests actual Search component rendering
- Verifies focus behavior with / key (lines 73-88)
- Tests navigation with j/k keys
- Verifies onNavigate called with correct args (lines 188-191)

**Risk Assessment:** Low risk

---

### 13. Settings.hotkeys.test.tsx
**Verdict: NEEDS WORK**

**Issues Found:**
- **Lines 134-160:** Only checks hotkey metadata, not actual behavior
  ```typescript
  it("j hotkey navigates to next section", async () => {
    const jHotkey = context.getRegisteredHotkeys().find((h) => h.key === "j");
    expect(jHotkey).toBeDefined();
    expect(jHotkey?.description).toBe("Navigate to next section");
    expect(jHotkey?.allowInInput).toBe(false);
  });
  ```
- Verifies the hotkey is *registered* but doesn't test it actually works
- Missing: Actually triggering the hotkey and verifying section navigation

**Risk Assessment:** Medium - hotkey registration could work but handler could be broken

**Recommended Fix:** Add tests that trigger the hotkeys and verify focus moves to next/previous section

---

### 14. contentHash.test.ts
**Verdict: GOOD**

Tests pure utility function for content hashing.

**Strengths:**
- Tests semantic equality (lines 6-28)
- Tests edge cases: empty blocks, nested children (lines 54-82)
- Verifies IDs are excluded from hash

**Risk Assessment:** Low risk

---

### 15. documentOpen.integration.test.ts
**Verdict: BROKEN/USELESS**

**Critical Issues:**
- **Lines 28-29:** Tests that a mock wasn't called - meaningless
  ```typescript
  it("should NOT call save on the mock after module load (sanity check)", () => {
    expect(DocumentServiceWrapper.save).not.toHaveBeenCalled();
  });
  ```
- **Lines 32-40:** Tests that calling mock returns what it was told to return
  ```typescript
  it("should be able to call save mock when explicitly invoked", async () => {
    await DocumentServiceWrapper.save({...});
    expect(DocumentServiceWrapper.save).toHaveBeenCalledTimes(1);
  });
  ```
- Despite being named "integration.test.ts", there is NO integration testing
- No actual document opening logic is tested

**Risk Assessment:** HIGH - provides false confidence, tests nothing real

**Recommended Fix:** Either delete this file or write real integration tests that verify document opening behavior

---

### 16. shortcut-conflicts.test.ts
**Verdict: NEEDS WORK**

**Issues Found:**
- **Lines 47-523:** `collectAllShortcuts()` is manually maintained, not derived from actual code
- Could drift from actual hotkey registrations
- Good concept for catching conflicts but implementation is fragile

**Strengths:**
- Good documentation of all shortcuts
- Detects conflicts in the hardcoded data

**Risk Assessment:** Medium - data could become stale without failing tests

**Recommended Fix:** Consider deriving shortcut list dynamically by importing from actual source files, or add a mechanism to verify the list stays in sync

---

### 17. shortcuts-command-palette.test.tsx
**Verdict: GOOD**

Comprehensive testing of command palette shortcuts.

**Strengths:**
- Tests actual CommandPalette component
- Tests arrow key navigation, Enter execution, Escape closing
- Tests fuzzy search filtering (lines 454-619)
- Tests sub-palette mode (lines 671-810)

**Risk Assessment:** Low risk

---

### 18. shortcuts-document-context.test.ts
**Verdict: NEEDS WORK**

**Issues Found:**
- **Lines 34-76:** Tests a local `getDocumentHotkeys()` function that returns mock data
  ```typescript
  const getDocumentHotkeys = (): HotkeyConfig[] => {
    return [
      { key: "mod+s", handler: vi.fn(), ... },
      ...
    ];
  };
  ```
- **Lines 156-200:** Creates local handlers instead of testing the real useDocumentController
  ```typescript
  const createSaveHandler = () => {
    return (event: KeyboardEvent) => {
      event.preventDefault();
      ...
    };
  };
  ```
- These are "documentation" tests that verify assumptions, not actual behavior

**Risk Assessment:** Medium - actual implementation could diverge from test assumptions

**Recommended Fix:** Import and test the actual useDocumentController hook

---

### 19. shortcuts-global-navigation.test.tsx
**Verdict: GOOD**

Tests global navigation shortcuts through the App component.

**Strengths:**
- Tests actual App component with real providers
- Verifies hotkey registration and triggering (lines 205-237)
- Tests multiple global shortcuts (mod+K, shift+/, mod+T, ctrl+Tab, quit)

**Risk Assessment:** Low risk

---

### 20. shortcuts-journal-context.test.ts
**Verdict: NEEDS WORK**

**Issues Found:**
- **Lines 33-103:** Tests mock configuration, not actual code
  ```typescript
  const getJournalHotkeys = (): HotkeyConfig[] => {
    return [
      { key: "ctrl+n", handler: vi.fn(), ... },
    ];
  };
  ```
- **Lines 216-290:** Creates local day navigation handlers
- Tests document expected behavior but don't verify actual implementation

**Risk Assessment:** Medium - actual useJournalController could have bugs

**Recommended Fix:** Test the actual useJournalController hook

---

### 21. shortcuts-list-navigation.test.ts
**Verdict: NEEDS WORK**

**Issues Found:**
- **Lines 39-127:** `getDashboardHotkeys()` returns mock configuration
- **Lines 203-261:** Creates local handlers for navigation
- Same pattern as other shortcuts-* files - tests assumptions, not implementation

**Risk Assessment:** Medium - documentation value but limited bug-catching ability

**Recommended Fix:** Test actual controller hooks

---

### 22. useAutoSave.test.ts
**Verdict: GOOD**

Excellent testing of the auto-save hook.

**Strengths:**
- Tests debouncing behavior with fake timers (lines 16-50)
- Tests concurrent save prevention (lines 52-95)
- Tests save state transitions (lines 131-193)
- Tests error handling with retry (lines 297-370)
- Tests isInitialized guard (lines 402-544)

**Risk Assessment:** Low risk

---

### 23. useDocumentPersistence.test.ts
**Verdict: GOOD**

Tests document persistence hook.

**Strengths:**
- Tests auto-save without notifications (lines 48-76)
- Tests concurrent save prevention (lines 78-106)
- Tests missing project handling (lines 145-168)

**Minor Issues:**
- **Line 108:** Skipped test: `it.skip("should handle errors silently", ...)`

**Risk Assessment:** Low risk

---

### 24. useFooterHints.test.ts
**Verdict: GOOD**

Tests footer hints hook.

**Strengths:**
- Tests all page hint configurations
- Tests memoization behavior (lines 166-182)
- Tests both useFooterHints hook and getHintsForPage function

**Risk Assessment:** Low risk

---

### 25. usePlainTextClipboard.test.ts
**Verdict: GOOD**

Tests clipboard hook for plain text copying.

**Strengths:**
- Tests event listener management (lines 41-97)
- Tests copy event handling with various selections (lines 100-320)
- Tests edge cases: collapsed selection, null selection, unicode, multiline

**Risk Assessment:** Low risk

---

### 26. useRecentDocuments.test.ts
**Verdict: GOOD**

Tests recent documents hook.

**Strengths:**
- Tests localStorage initialization and persistence
- Tests document adding, deduplication, trimming (lines 71-191)
- Tests cross-tab synchronization (lines 229-267)
- Tests invalid data handling

**Risk Assessment:** Low risk

---

## Critical Issues Summary

### BROKEN/USELESS (Must Fix)
1. **documentOpen.integration.test.ts** - Tests mock behavior, not actual integration

### High Priority (NEEDS WORK)
1. **Dashboard.pageHeader.test.tsx** - Tests fake component, not real one
2. **Settings.hotkeys.test.tsx** - Only checks registration, not behavior
3. **HOTKEYS_MASTER.test.tsx** - Documentation only, no real tests

### Medium Priority (NEEDS WORK)
1. **shortcut-conflicts.test.ts** - Manually maintained data could drift
2. **shortcuts-document-context.test.ts** - Tests assumptions, not code
3. **shortcuts-journal-context.test.ts** - Tests assumptions, not code
4. **shortcuts-list-navigation.test.ts** - Tests assumptions, not code

---

## Coverage Gaps Identified

1. **No tests for actual hotkey handler behavior in Settings page** - only registration is verified
2. **documentOpen integration** - despite the filename, no actual integration testing
3. **Shortcut conflict detection** relies on manually maintained data

---

## Prioritized Action Plan

1. **DELETE or REWRITE** `documentOpen.integration.test.ts` - provides false confidence
2. **FIX** `Dashboard.pageHeader.test.tsx` - test actual component
3. **ENHANCE** `Settings.hotkeys.test.tsx` - add behavior tests
4. **CONVERT** `HOTKEYS_MASTER.test.tsx` - make it dynamic or remove
5. **IMPROVE** shortcuts-document-context, shortcuts-journal-context, shortcuts-list-navigation - test actual hooks instead of mock configurations
6. **AUTOMATE** `shortcut-conflicts.test.ts` - derive data from source files
