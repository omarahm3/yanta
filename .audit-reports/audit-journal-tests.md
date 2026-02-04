# Audit: src/pages/Journal/__tests__/ (7 files)

**Date:** 2026-02-04
**Auditor:** Claude Code Agent
**Phase:** 2.1 - Page Tests Audit

## Summary

| Verdict | Count | Percentage |
|---------|-------|------------|
| GOOD | 5 | 71.4% |
| NEEDS WORK | 2 | 28.6% |
| BROKEN/USELESS | 0 | 0% |

---

## File-by-File Audit

### 1. DatePicker.test.tsx (110 lines) - **GOOD**

**Real Behavior:** ✅ Tests actual user interactions - navigation, calendar opening, date selection
**Meaningful Assertions:** ✅ Verifies callback arguments, DOM elements, data attributes
**Isolation:** ✅ No mocking beyond callback spies
**Code Quality:** ✅ Clean, well-organized

**Strengths:**
- Uses accessible queries (`getByLabelText`, `getByRole`)
- Tests complete user flows (open calendar → select date → verify callback)
- Tests boundary cases (navigating months, "today" button)
- Line 60-61: Properly uses data-attributes (`data-has-entries`) instead of inline styles

```typescript
// Line 60-61: Good pattern - testing via data attributes
expect(day28.closest("[data-has-entries]")).toHaveAttribute("data-has-entries", "true");
```

**Minor Note:** Uses `fireEvent` instead of `userEvent`, but acceptable for these tests.

---

### 2. Journal.test.tsx (245 lines) - **GOOD**

**Real Behavior:** ✅ Tests full component integration with proper async handling
**Meaningful Assertions:** ✅ Verifies DOM content, service call arguments, user flow completion
**Isolation:** ✅ Appropriate mocks - only Layout and external Wails services
**Code Quality:** ✅ Proper `waitFor`, `beforeEach` cleanup

**Strengths:**
- Tests actual component behavior, not mock orchestration
- Line 217: Verifies service was called with correct arguments, not just that it was called
- Tests empty state rendering
- Tests multi-step flows (select → delete → confirm dialog → confirm button → verify delete)
- Tests initial date prop handling

```typescript
// Line 217: Good - verifies specific arguments
expect(DeleteEntry).toHaveBeenCalledWith("personal", expect.any(String), "abc123");
```

**Note:** Mocking is appropriate here - Layout and external Wails services are outside the unit under test.

---

### 3. Journal.pageHeader.test.tsx (61 lines) - **NEEDS WORK**

**Real Behavior:** ❌ Tests a synthetic `TestComponent`, not the actual Journal page header
**Meaningful Assertions:** ⚠️ Tests inline CSS styles (implementation details)
**Isolation:** ✅ No mocking needed
**Code Quality:** ⚠️ Tests duplicate inline style patterns

**Issues Found:**

1. **Lines 17-28:** Tests a fake `TestComponent` instead of the actual component
```typescript
// Testing fake component, not real implementation
const TestComponent = () => (
  <div className="p-4 border-b border-border">
    <div className="flex items-center justify-between mb-3">
      <BookOpen
        className="w-5 h-5"
        style={{ color: "var(--mode-accent)" }}
```

2. **Line 40:** Tests inline CSS style value
```typescript
// Line 40: Fragile - tests implementation detail
expect(icon).toHaveStyle({ color: "var(--mode-accent)" });
```

3. **Lines 43-60:** Second test also uses synthetic component

**Risk Assessment:**
- Tests will pass even if actual Journal header is broken
- Tests will fail if styling moves from inline to CSS classes, even though feature works

**Recommended Fixes:**
- Test the actual Journal component's header rendering
- Replace style assertions with data-attribute checks (e.g., `data-mode-icon`)
- Or remove this file entirely if Journal.test.tsx already covers header rendering

---

### 4. JournalEntry.test.tsx (115 lines) - **GOOD** (with minor issues)

**Real Behavior:** ✅ Tests actual component rendering and interactions
**Meaningful Assertions:** ✅ Most assertions verify meaningful outcomes
**Isolation:** ✅ No mocking beyond callback spies
**Code Quality:** ⚠️ Two tests check inline styles

**Strengths:**
- Tests content rendering, tags, timestamps, selection states
- Tests callback arguments (not just "was called")
- Tests edge case: entry without tags
- Line 46: Verifies correct ID passed to callback

```typescript
// Line 46: Good - verifies specific argument
expect(onEntryClick).toHaveBeenCalledWith("abc123");
```

**Minor Issues (same pattern as documented gotcha):**

1. **Lines 88-97:** Tests inline styles for highlighted state
```typescript
// Lines 93-96: Fragile - tests inline styles
expect(entry).toHaveStyle({
  borderLeftColor: "var(--mode-accent)",
  backgroundColor: "var(--mode-accent-muted)",
});
```

2. **Lines 99-107:** Tests inline styles for selected state
```typescript
// Lines 104-106: Fragile - tests inline styles
expect(entry).toHaveStyle({
  borderLeftColor: "var(--mode-accent)",
});
```

**Risk Assessment:** Low - these are only 2 of 14 tests, and the file overall tests real behavior well.

**Verdict: GOOD** - The style tests are a minor issue; 85% of the file tests real behavior correctly.

---

### 5. JournalEntry.modeAccent.test.tsx (74 lines) - **NEEDS WORK**

**Real Behavior:** ⚠️ Tests actual component but only implementation details
**Meaningful Assertions:** ❌ All assertions are inline CSS style checks
**Isolation:** ✅ No mocking beyond callback spies
**Code Quality:** ⚠️ Entire file tests fragile implementation details

**Issues Found:**

This file tests ONLY inline CSS styles - the exact pattern documented in our gotchas:

1. **Lines 13-23:** Tests borderLeftColor and backgroundColor inline styles
```typescript
// Lines 19-22: Tests implementation detail
expect(entry).toHaveStyle({
  borderLeftColor: "var(--mode-accent)",
  backgroundColor: "var(--mode-accent-muted)",
});
```

2. **Lines 25-32:** Tests borderLeftColor for selected state
```typescript
// Lines 29-31
expect(entry).toHaveStyle({
  borderLeftColor: "var(--mode-accent)",
});
```

3. **Lines 34-50:** Tests toggle button styles
```typescript
// Lines 46-49
expect(toggle).toHaveStyle({
  borderColor: "var(--mode-accent)",
  color: "var(--mode-accent)",
});
```

4. **Lines 52-60, 62-73:** Tests index span color and font-weight

**Risk Assessment:** HIGH
- If styling implementation changes from inline to CSS classes, ALL tests fail
- No actual user-visible behavior is tested
- Provides false confidence - tests pass but don't verify meaningful outcomes

**Recommended Fixes:**
- Replace with data-attribute testing (e.g., `data-state="highlighted"`, `data-state="selected"`)
- Or use visual regression testing for styling concerns
- Or remove file if JournalEntry.test.tsx adequately covers the component

---

### 6. useJournal.test.ts (221 lines) - **GOOD**

**Real Behavior:** ✅ Tests actual hook state management and service integration
**Meaningful Assertions:** ✅ Verifies return values, state changes, service call arguments
**Isolation:** ✅ Only mocks external Wails service (appropriate)
**Code Quality:** ✅ Proper async handling with `waitFor`, `act`

**Strengths:**
- Tests loading state transitions
- Tests empty state handling
- Line 47: Verifies service called with correct date format
- Line 104: Verifies delete service called with all required arguments
- Line 133-141: Verifies promoteToDocument with complete argument structure
- Tests selection state management (toggle, clear)

```typescript
// Line 104: Good - verifies all arguments
expect(mockDelete).toHaveBeenCalledWith("personal", "2026-01-30", "abc123");

// Lines 133-140: Good - verifies complex object structure
expect(mockPromote).toHaveBeenCalledWith({
  sourceProject: "personal",
  date: "2026-01-30",
  entryIds: ["abc123"],
  targetProject: "work",
  title: "Bug Fix Notes",
  keepOriginal: false,
});
```

**Excellent Pattern:** Tests actual return values from hook, not just that functions were called.

---

### 7. useJournalController.test.ts (325 lines) - **GOOD**

**Real Behavior:** ✅ Tests keyboard navigation, selection, state management
**Meaningful Assertions:** ✅ Verifies state values, boundary conditions, hotkey configuration
**Isolation:** ✅ Appropriate mocks for contexts and services
**Code Quality:** ✅ Comprehensive coverage of edge cases

**Strengths:**
- Tests boundary conditions (lines 103-117, 119-136): can't go below 0 or above max
- Tests hotkey configuration completeness (lines 191-218)
- Tests confirm dialog state management
- Tests plural vs singular message handling (line 296)

```typescript
// Lines 103-117: Good boundary testing
it("does not go below 0 when highlighting previous", async () => {
  expect(result.current.highlightedIndex).toBe(0);
  act(() => {
    result.current.highlightPrevious();
  });
  expect(result.current.highlightedIndex).toBe(0);
});

// Lines 202-217: Good - verifies hotkey configuration
const keys = result.current.hotkeys.map((h) => h.key);
expect(keys).toContain("j");
expect(keys).toContain("k");
// ...
expect(keys).not.toContain("mod+A"); // Verifies removed hotkeys
```

**Note:** The mocking here is appropriate - contexts and external services are outside the hook's responsibility.

---

## Key Findings

### Patterns Identified

1. **Inline CSS Style Testing (Recurring Issue)**
   - Files affected: `Journal.pageHeader.test.tsx`, `JournalEntry.modeAccent.test.tsx`, `JournalEntry.test.tsx` (2 tests)
   - Same gotcha pattern found in previous audits (DocumentList.modeAccent.test.tsx, ContextBar.test.tsx)
   - Total: 12 assertions testing inline styles across these files

2. **Synthetic Component Testing**
   - `Journal.pageHeader.test.tsx` tests a fake TestComponent, not the actual component
   - Provides zero confidence about actual implementation

3. **Hook Tests are Strong**
   - Both `useJournal.test.ts` and `useJournalController.test.ts` are excellent
   - Proper async handling, meaningful assertions, boundary testing
   - Consistent with the high quality found in `src/hooks/__tests__/`

### What Could Slip Through

| Test File | Bug That Could Slip Through |
|-----------|----------------------------|
| Journal.pageHeader.test.tsx | Entire header could be broken; only tests fake component |
| JournalEntry.modeAccent.test.tsx | Visual styling regression if implementation changes |

### Coverage Gaps

1. **Journal Entry Editing** - No tests for inline editing of journal entries
2. **Error Handling** - Limited testing of service error states
3. **Keyboard Navigation in Calendar** - DatePicker tests don't cover keyboard-based date selection

---

## Recommended Priority Fixes

1. **HIGH: Remove or rewrite Journal.pageHeader.test.tsx**
   - Currently tests fake component, provides false confidence
   - Either test actual Journal component header rendering or remove file

2. **MEDIUM: Replace style assertions in JournalEntry.modeAccent.test.tsx**
   - Add data-attributes to component (e.g., `data-state="highlighted"`)
   - Test via attributes instead of inline styles
   - Or remove file if JournalEntry.test.tsx coverage is sufficient

3. **LOW: Clean up style tests in JournalEntry.test.tsx**
   - Lines 88-107 could use data-attribute testing
   - Low priority since only 2 of 14 tests affected
