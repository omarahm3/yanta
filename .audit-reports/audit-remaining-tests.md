# Audit: Remaining Directories (document, settings, utils - 5 files)

**Date:** 2026-02-04
**Auditor:** Claude Code Agent
**Phase:** 2.3 - Page Tests Audit

## Summary

| Verdict | Count | Percentage |
|---------|-------|------------|
| GOOD | 4 | 80% |
| NEEDS WORK | 1 | 20% |
| BROKEN/USELESS | 0 | 0% |

---

## File-by-File Audit

### 1. src/components/document/__tests__/DocumentContent.pageHeader.test.tsx (55 lines) - **NEEDS WORK**

**Real Behavior:** ❌ Tests a synthetic `TestComponent`, not the actual DocumentContent component
**Meaningful Assertions:** ⚠️ Tests inline CSS styles (implementation details)
**Isolation:** ✅ No mocking needed
**Code Quality:** ⚠️ Tests duplicate inline style patterns

**Issues Found:**

1. **Lines 13-25:** Tests a fake `TestComponent` instead of the actual component
```typescript
// Testing fake component, not real implementation
const TestComponent = () => (
  <div className="px-4 pt-4 pb-2 border-b border-border">
    <div className="flex items-center gap-2">
      <FileText
        className="w-5 h-5"
        style={{ color: "var(--mode-accent)" }}
        aria-hidden="true"
        data-testid="mode-icon"
      />
      <span className="text-sm text-text-dim">Document</span>
    </div>
  </div>
);
```

2. **Line 37:** Tests inline CSS style value
```typescript
// Line 37: Fragile - tests implementation detail
expect(icon).toHaveStyle({ color: "var(--mode-accent)" });
```

3. **Lines 40-53:** Second test also uses synthetic component and tests CSS classes
```typescript
// Line 53: Tests className presence
expect(container).toHaveClass("flex", "items-center", "gap-2");
```

**Risk Assessment:**
- Tests will pass even if actual DocumentContent header is broken
- Tests will fail if styling moves from inline to CSS classes, even though feature works
- **This is the SAME pattern found in Journal.pageHeader.test.tsx and Dashboard.pageHeader.test.tsx**

**Recommended Fixes:**
- Test the actual DocumentContent component's header rendering
- Replace style assertions with data-attribute checks (e.g., `data-mode-icon`)
- Or remove this file entirely if other tests cover header rendering

---

### 2. src/pages/settings/__tests__/AboutSection.test.tsx (283 lines) - **GOOD**

**Real Behavior:** ✅ Tests actual component with real context providers
**Meaningful Assertions:** ✅ Verifies DOM content, localStorage changes, dialog behavior
**Isolation:** ✅ Only mocks Toast provider (appropriate)
**Code Quality:** ✅ Excellent organization, proper cleanup in beforeEach

**Strengths:**

1. **Proper Context Integration (Lines 43-48):**
```typescript
const renderAboutSection = (systemInfo: SystemInfo | null = mockSystemInfo) => {
  return render(
    <DialogProvider>
      <AboutSection systemInfo={systemInfo} ref={null} />
    </DialogProvider>,
  );
};
```

2. **Tests Loading State (Lines 57-60):**
```typescript
it("renders loading state when systemInfo is null", () => {
  renderAboutSection(null);
  expect(screen.getByText("Loading system information...")).toBeInTheDocument();
});
```

3. **Tests Complete User Flows (Lines 145-161):**
```typescript
// Tests: click reset → dialog appears → confirm → localStorage cleared
it("resets onboarding when confirmed", () => {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({...}));
  renderAboutSection();
  fireEvent.click(screen.getByRole("button", { name: "Reset Onboarding" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();
});
```

4. **Verifies Real Side Effects (Lines 197-214):**
```typescript
it("resets progress when confirmed", () => {
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
    documentsCreated: 5,
    journalEntriesCreated: 3,
    ...
  }));
  renderAboutSection();
  fireEvent.click(screen.getByRole("button", { name: "Reset Hints" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
});
```

5. **Tests Edge Cases (Lines 95-102, 226-256):**
```typescript
// Tests N/A fallback for missing build commit
it("shows N/A for missing build commit", () => {
  const infoWithoutCommit: SystemInfo = {...};
  renderAboutSection(infoWithoutCommit);
  expect(screen.getByText("N/A")).toBeInTheDocument();
});

// Tests conditional hint count display
it("displays hint count when hints have been shown", () => {...});
it("does not display hint count when no hints shown", () => {...});
```

**Excellent Pattern:** Tests actual localStorage persistence - real side effects, not mock orchestration.

---

### 3. src/utils/__tests__/accessibility.test.ts (80 lines) - **GOOD**

**Real Behavior:** ✅ Tests actual utility function with real DOM manipulation
**Meaningful Assertions:** ✅ Verifies aria attributes, DOM content, timing behavior
**Isolation:** ✅ No mocking except timers (appropriate)
**Code Quality:** ✅ Proper async handling, fake timers for timeout testing

**Strengths:**

1. **Tests Real DOM Creation (Lines 15-22):**
```typescript
it("creates an aria-live region in the document", () => {
  announceForScreenReaders("Test message");

  const liveRegion = document.querySelector('[role="status"][aria-live]');
  expect(liveRegion).not.toBeNull();
  expect(liveRegion?.getAttribute("aria-live")).toBe("polite");
  expect(liveRegion?.getAttribute("aria-atomic")).toBe("true");
});
```

2. **Proper Async Handling (Lines 24-32):**
```typescript
it("sets the message content after requestAnimationFrame", async () => {
  announceForScreenReaders("Test message");
  // Wait for requestAnimationFrame to execute
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const liveRegion = document.querySelector('[role="status"][aria-live]');
  expect(liveRegion?.textContent).toBe("Test message");
});
```

3. **Tests Politeness Levels (Lines 34-46):**
```typescript
it("uses polite politeness by default", () => {...});
it("uses assertive politeness when specified", () => {...});
```

4. **Tests Singleton Pattern (Lines 59-65):**
```typescript
it("reuses the same live region for multiple announcements", () => {
  announceForScreenReaders("First message");
  announceForScreenReaders("Second message");
  const liveRegions = document.querySelectorAll('[role="status"][aria-live]');
  expect(liveRegions.length).toBe(1);
});
```

5. **Tests Cleanup Timing (Lines 67-79):**
```typescript
it("clears the message after timeout", async () => {
  vi.useFakeTimers();
  announceForScreenReaders("Test message");
  await vi.advanceTimersByTimeAsync(100); // for rAF
  await vi.advanceTimersByTimeAsync(1100); // for setTimeout
  const liveRegion = document.querySelector('[role="status"][aria-live]');
  expect(liveRegion?.textContent).toBe("");
  vi.useRealTimers();
});
```

**Excellent Pattern:** Tests accessibility features with proper async/timer handling.

---

### 4. src/utils/__tests__/commandPreprocessor.test.ts (183 lines) - **GOOD**

**Real Behavior:** ✅ Pure unit tests for preprocessing logic
**Meaningful Assertions:** ✅ Verifies exact output strings for given inputs
**Isolation:** ✅ No mocking needed (pure function)
**Code Quality:** ✅ Excellent documentation via describe blocks, comprehensive edge cases

**Strengths:**

1. **Tests Core Functionality (Lines 21-36):**
```typescript
it("fills selected document paths when archive has no args", () => {
  const selected = [documents[0].path, documents[2].path];
  const result = preprocessCommand("archive", documents, selected);
  expect(result).toBe(`archive ${documents[0].path},${documents[2].path}`);
});

it("fills selected document paths before --hard flag", () => {
  const selected = [documents[1].path];
  const result = preprocessCommand("delete --hard", documents, selected);
  expect(result).toBe(`delete ${documents[1].path} --hard`);
});
```

2. **Tests Numeric Shortcuts (Lines 39-52):**
```typescript
it("converts numeric shortcuts when no selection", () => {
  const result = preprocessCommand("archive 2", documents);
  expect(result).toBe(`archive ${documents[1].path}`);
});

it("converts numeric shortcuts with --hard flag", () => {
  const result = preprocessCommand("delete 2 --hard", documents);
  expect(result).toBe(`delete ${documents[1].path} --hard`);
});
```

3. **Documents Edge Cases (Lines 59-85):**
```typescript
describe("commands are trimmed by CommandLine.tsx, NOT by preprocessor", () => {
  it("should NOT trim commands - already trimmed by CommandLine", () => {...});
  it("should preserve whitespace in non-expanded commands", () => {...});
});

describe("empty commands handled by CommandLine.tsx, NOT by preprocessor", () => {
  it("should NOT check for empty commands - returns input as-is", () => {...});
  it("should NOT check for whitespace-only commands", () => {...});
});
```

4. **Tests Flag Combinations (Lines 87-139):**
```typescript
describe("--force is ONLY for bypassing confirmation, NOT required for --hard", () => {...});
describe("--force works globally on ALL danger commands", () => {...});
```

5. **Tests Pass-Through Behavior (Lines 158-173):**
```typescript
describe("commands without danger actions pass through unchanged", () => {
  it("should not modify doc command", () => {...});
  it("should not modify new command", () => {...});
  it("should not add --force to non-danger commands", () => {...});
});
```

**Excellent Pattern:** Pure unit tests with comprehensive edge case coverage. Self-documenting via descriptive describe/it blocks.

---

### 5. src/utils/__tests__/commandSorting.test.ts (390 lines) - **GOOD**

**Real Behavior:** ✅ Tests actual sorting algorithms with real data structures
**Meaningful Assertions:** ✅ Verifies output order, array contents, return types
**Isolation:** ✅ Only uses fake timers (appropriate for time-based logic)
**Code Quality:** ✅ Excellent use of time constants, comprehensive coverage

**Strengths:**

1. **Tests All Exported Functions:**
   - `sortCommandsByUsage` (Lines 27-152)
   - `getRecentlyUsedCommands` (Lines 155-237)
   - `isRecentlyUsed` (Lines 239-288)
   - `getTopRecentCommandIds` (Lines 290-389)

2. **Proper Time-Based Testing (Lines 28-37):**
```typescript
const now = 1700000000000; // Fixed timestamp for testing

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
});
```

3. **Tests Sorting Logic (Lines 59-71):**
```typescript
it("prioritizes more recently used commands over older ones", () => {
  const commands = [createCommand("cmd-a"), createCommand("cmd-b"), createCommand("cmd-c")];
  const usage: CommandUsageRecord = {
    "cmd-a": { lastUsed: now - 2 * DAY_MS, useCount: 1 },
    "cmd-b": { lastUsed: now - 30 * 60 * 1000, useCount: 1 },
    "cmd-c": { lastUsed: now - 5 * HOUR_MS, useCount: 1 },
  };
  const sorted = sortCommandsByUsage(commands, usage);
  expect(sorted.map((c) => c.id)).toEqual(["cmd-b", "cmd-c", "cmd-a"]);
});
```

4. **Tests Immutability (Lines 117-127):**
```typescript
it("does not mutate the original commands array", () => {
  const commands = [createCommand("cmd-a"), createCommand("cmd-b")];
  const originalOrder = [...commands];
  const usage: CommandUsageRecord = {...};
  sortCommandsByUsage(commands, usage);
  expect(commands).toEqual(originalOrder);
});
```

5. **Tests Edge Cases:**
   - Empty arrays (Lines 129-138)
   - Boundary conditions (Lines 273-287): exactly 1 hour ago vs just under
   - Return type verification (Lines 381-388)

6. **Tests Business Logic (Lines 87-100):**
```typescript
it("caps frequency boost to prevent domination", () => {
  const usage: CommandUsageRecord = {
    "cmd-a": { lastUsed: now - 5 * 60 * 1000, useCount: 5 },
    "cmd-b": { lastUsed: now - 2 * WEEK_MS, useCount: 1000 },
  };
  const sorted = sortCommandsByUsage(commands, usage);
  expect(sorted[0].id).toBe("cmd-a"); // Recency wins over high frequency
});
```

**Excellent Pattern:** Comprehensive testing of time-based sorting algorithms with proper fake timers.

---

## Key Findings

### Patterns Identified

1. **Synthetic Component Testing (NEEDS WORK)**
   - Files affected: `DocumentContent.pageHeader.test.tsx`
   - Same pattern found in `Journal.pageHeader.test.tsx` and `Dashboard.pageHeader.test.tsx`
   - Total: 3 files across codebase using this problematic pattern

2. **Utility Tests are Excellent (GOOD)**
   - All 3 files in `src/utils/__tests__/` demonstrate excellent practices
   - Pure unit tests, comprehensive edge cases, proper time handling
   - Strong coverage of accessibility, command preprocessing, and sorting

3. **Settings Tests are Strong (GOOD)**
   - `AboutSection.test.tsx` tests real component behavior
   - Proper context integration, localStorage persistence testing
   - Complete user flow testing

### What Could Slip Through

| Test File | Bug That Could Slip Through |
|-----------|----------------------------|
| DocumentContent.pageHeader.test.tsx | Entire header could be broken; only tests fake component |

### Coverage Gaps

1. **Document Component Testing** - Only 1 test file for document components, and it tests a synthetic component
2. **Settings Page Coverage** - Only AboutSection tested; other settings sections may lack coverage

---

## Recommended Priority Fixes

1. **HIGH: Remove or rewrite DocumentContent.pageHeader.test.tsx**
   - Currently tests fake component, provides false confidence
   - Either test actual DocumentContent component header rendering or remove file
   - This completes the pattern of 3 pageHeader test files that all need the same fix

2. **NONE for utils/__tests__/** - All 3 files are excellent and need no changes

3. **NONE for AboutSection.test.tsx** - Excellent test file with real behavior testing
