# Hotkey Testing Guide - TDD Approach

## Overview

This document provides a **Test-Driven Development (TDD)** guide for adding and testing hotkeys in Yanta. All application hotkeys must be tested using the KISS (Keep It Simple, Stupid) principle with a 5-second timeout requirement.

## Current Coverage Status

```
✅ All tests passing
✅ 9 test files
✅ 100% hotkey coverage (43/43 hotkeys)
✅ All tests complete within 5 seconds
✅ ~3 second total runtime
```

---

## TDD Workflow: Adding a New Hotkey

### Step 1: Write the Test FIRST (Red Phase)

**Before writing any implementation code**, create a test that defines the expected behavior.

#### Example: Adding a new "Copy Document" hotkey

**File:** `src/__tests__/Document.hotkeys.test.tsx`

```typescript
import { act, render, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { HotkeyProvider, useHotkeyContext } from "../contexts";
import type { HotkeyContextValue } from "../types/hotkeys";

// Mock the copy handler
const mockCopyDocument = vi.fn();

vi.mock("../hooks/useDocumentActions", () => ({
  useDocumentActions: () => ({
    copyDocument: mockCopyDocument,
  }),
}));

describe("Document hotkeys", () => {
  it("copies document with mod+D", async () => {
    let context: HotkeyContextValue | null = null;

    render(
      <HotkeyProvider>
        <HotkeyProbe onReady={(ctx) => (context = ctx)} />
        <Document onNavigate={vi.fn()} initialTitle="Test" />
      </HotkeyProvider>
    );

    await waitFor(() => expect(context).not.toBeNull());

    const hotkey = context!.getRegisteredHotkeys().find(h => h.key === "mod+D");
    expect(hotkey).toBeDefined();
    expect(hotkey!.description).toBe("Copy document");

    await act(async () => {
      hotkey!.handler(new KeyboardEvent("keydown", { key: "d", ctrlKey: true }));
    });

    expect(mockCopyDocument).toHaveBeenCalledTimes(1);
  });
});
```

**Run tests:** `npm run test:hotkeys`
- ❌ Test fails (expected - no implementation yet)

---

### Step 2: Implement the Hotkey (Green Phase)

Now implement the actual hotkey in your component.

**File:** `src/pages/Document.tsx`

```typescript
import { useHotkeys } from "../hooks";
import { useDocumentActions } from "../hooks/useDocumentActions";

export const Document: React.FC<DocumentProps> = ({ onNavigate }) => {
  const { copyDocument } = useDocumentActions();

  useHotkeys([
    {
      key: "mod+D",
      handler: (event: KeyboardEvent) => {
        event.preventDefault();
        copyDocument();
      },
      allowInInput: true,
      description: "Copy document",
    },
  ]);

  // ... rest of component
};
```

**Run tests:** `npm run test:hotkeys`
- ✅ Test passes (implementation works!)

---

### Step 3: Update Documentation (Blue Phase - Refactor)

Update the master coverage tracker to document the new hotkey.

**File:** `src/__tests__/HOTKEYS_MASTER.test.tsx`

```typescript
const coverage = {
  // ... existing entries
  document: {
    component: "Document.tsx",
    hotkeys: [
      "mod+s",
      "Escape",
      "mod+C",
      "Enter",
      "mod+D"  // ← Add new hotkey here
    ],
    testFile: "Document.hotkeys.test.tsx",
  },
};

const totalHotkeys = Object.values(coverage).reduce(
  (sum, data) => sum + data.hotkeys.length,
  0
);

expect(totalHotkeys).toBe(44); // Update count: 43 → 44
```

**Run tests:** `npm run test:hotkeys`
- ✅ All tests pass including master coverage

---

## Two Testing Strategies

### Strategy 1: HotkeyProvider-based Hotkeys

Use this for hotkeys registered via `useHotkey()` or `useHotkeys()` hooks.

**When to use:**
- Component uses `useHotkey()` or `useHotkeys()` from contexts
- Hotkey needs to be globally registered and discoverable
- Hotkey should appear in help modal

**TDD Pattern:**

```typescript
// STEP 1: Write test
it("does something with mod+X", async () => {
  let context: HotkeyContextValue | null = null;

  render(
    <HotkeyProvider>
      <HotkeyProbe onReady={(ctx) => (context = ctx)} />
      <MyComponent />
    </HotkeyProvider>
  );

  await waitFor(() => expect(context).not.toBeNull());

  const hotkey = context!.getRegisteredHotkeys().find(h => h.key === "mod+X");
  expect(hotkey).toBeDefined();

  await act(async () => {
    hotkey!.handler(new KeyboardEvent("keydown", { key: "x", ctrlKey: true }));
  });

  // Assert expected behavior
  expect(mockAction).toHaveBeenCalled();
});
```

```typescript
// STEP 2: Implement
export const MyComponent = () => {
  useHotkey({
    key: "mod+X",
    handler: handleAction,
    description: "Do something",
  });
};
```

---

### Strategy 2: Direct Event Listener Hotkeys

Use this for hotkeys attached via `addEventListener("keydown")`.

**When to use:**
- Component needs fine-grained control over keyboard events
- Hotkey behavior depends on complex DOM state
- Hotkey is component-specific (not global)

**TDD Pattern:**

```typescript
// STEP 1: Write test
it("closes modal with Escape", async () => {
  const onClose = vi.fn();
  render(<Modal isOpen={true} onClose={onClose} />);

  fireEvent.keyDown(document, { key: "Escape" });

  expect(onClose).toHaveBeenCalledTimes(1);
});
```

```typescript
// STEP 2: Implement
export const Modal = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);
};
```

---

## Complete TDD Example: Adding "Archive All" Hotkey

### 1. Write Failing Test

**File:** `src/__tests__/Dashboard.hotkeys.test.tsx`

```typescript
it("archives all documents with mod+shift+D", async () => {
  const ctx = await renderDashboard();
  const hotkey = getHotkey(ctx, "mod+shift+D");

  expect(hotkey.description).toBe("Archive all visible documents");

  await act(async () => {
    hotkey.handler(new KeyboardEvent("keydown", {
      key: "D",
      ctrlKey: true,
      shiftKey: true
    }));
  });

  expect(mockArchiveAll).toHaveBeenCalledWith(documents);
  expect(mockSuccess).toHaveBeenCalledWith("All documents archived");
});
```

**Run:** `npm run test:hotkeys` → ❌ **FAILS** (hotkey not registered)

---

### 2. Implement Minimal Code

**File:** `src/pages/Dashboard.tsx`

```typescript
const handleArchiveAll = useCallback(() => {
  archiveAll(documents);
  success("All documents archived");
}, [documents, archiveAll, success]);

useHotkeys([
  // ... existing hotkeys
  {
    key: "mod+shift+D",
    handler: handleArchiveAll,
    allowInInput: false,
    description: "Archive all visible documents",
  },
]);
```

**Run:** `npm run test:hotkeys` → ✅ **PASSES**

---

### 3. Update Master Coverage

**File:** `src/__tests__/HOTKEYS_MASTER.test.tsx`

```typescript
dashboard: {
  component: "Dashboard.tsx",
  hotkeys: [
    "mod+N",
    "mod+shift+A",
    "j",
    "k",
    "ArrowDown",
    "ArrowUp",
    "Enter",
    "mod+A",
    "mod+U",
    "mod+shift+D"  // ← New hotkey
  ],
  testFile: "Dashboard.hotkeys.test.tsx",
},

expect(totalHotkeys).toBe(44); // Update from 43
```

**Run:** `npm run test:hotkeys` → ✅ **ALL PASS**

---

### 4. Update Documentation Table

Add entry to the coverage table in this file:

```markdown
### Dashboard Hotkeys (Dashboard.tsx)
| Hotkey | Action | Test File |
|--------|--------|-----------|
| ... existing entries ... |
| `Mod+Shift+D` | Archive all documents | Dashboard.hotkeys.test.tsx |
```

✅ **TDD Cycle Complete!**

---

## Running Tests

```bash
# Run all hotkey tests (use this during TDD)
npm run test:hotkeys

# Watch mode - auto-rerun on file changes
npm run test:hotkeys:watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npm run test:hotkeys -- Document.hotkeys.test.tsx
```

---

## Test Structure Templates

### HotkeyProbe Helper (Copy-Paste Ready)

```typescript
const HotkeyProbe: React.FC<{ onReady: (ctx: HotkeyContextValue) => void }> = ({
  onReady,
}) => {
  const ctx = useHotkeyContext();
  React.useEffect(() => {
    onReady(ctx);
  }, [ctx, onReady]);
  return null;
};
```

### Helper Function to Get Hotkey (Copy-Paste Ready)

```typescript
const getHotkey = (ctx: HotkeyContextValue, key: string) => {
  const hotkey = ctx.getRegisteredHotkeys().find((h) => h.key === key);
  expect(hotkey).toBeDefined();
  return hotkey!;
};
```

### Common Mock Setup (Copy-Paste Ready)

```typescript
const mockAction = vi.fn();
const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock("../hooks/useNotification", () => ({
  useNotification: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

beforeEach(() => {
  mockAction.mockClear();
  mockSuccess.mockClear();
  mockError.mockClear();
});
```

---

## TDD Best Practices

### ✅ DO:

1. **Write test before implementation** (Red → Green → Refactor)
2. **Write minimal code** to make test pass
3. **Run tests frequently** during development
4. **Test behavior, not implementation**
5. **Use descriptive test names** that explain what the hotkey does
6. **Update HOTKEYS_MASTER.test.tsx** immediately after test passes
7. **Keep tests simple** - one assertion per test when possible
8. **Mock external dependencies** to isolate hotkey behavior

### ❌ DON'T:

1. **Write implementation before test** (breaks TDD cycle)
2. **Skip the failing test phase** (defeats purpose of TDD)
3. **Test implementation details** (test what user experiences)
4. **Create complex test setups** (violates KISS principle)
5. **Ignore failing tests** (fix immediately or remove test)
6. **Use real timers in tests** (causes flakiness and timeouts)
7. **Extract keyboard logic** into separate files just for testing
8. **Forget to update documentation** after test passes

---

## TDD Troubleshooting

### Test Fails but Implementation Seems Correct

**Problem:** Hotkey works in browser but test fails

**Solutions:**
1. Check keyboard event properties match (key, ctrlKey, shiftKey, etc.)
2. Verify component is fully rendered before invoking handler
3. Use `waitFor()` if handler triggers async state updates
4. Check mocks are cleared between tests (`beforeEach`)

**Example:**
```typescript
// ❌ Wrong - key doesn't match
fireEvent.keyDown(document, { key: "s" }); // lowercase
// Component expects: { key: "S" } // uppercase

// ✅ Correct
fireEvent.keyDown(document, { key: "S", ctrlKey: true });
```

---

### Test Times Out (>5 seconds)

**Problem:** Test hangs waiting for assertion

**Solutions:**
1. Don't use `vi.useFakeTimers()` with `waitFor()`
2. Use synchronous assertions after `vi.runAllTimers()`
3. Verify keyboard event is actually firing

**Example:**
```typescript
// ❌ Wrong - causes timeout
vi.useFakeTimers();
await waitFor(() => expect(value).toBe("test"));

// ✅ Correct
vi.useFakeTimers();
await act(async () => { hotkey.handler(...); });
act(() => { vi.runAllTimers(); });
vi.useRealTimers();
expect(value).toBe("test");
```

---

### Handler Not Found

**Problem:** `getRegisteredHotkeys().find(...)` returns undefined

**Solutions:**
1. Verify component is rendered in `<HotkeyProvider>`
2. Check hotkey key string matches exactly (case-sensitive!)
3. Use `waitFor()` to ensure `useEffect` has run

**Example:**
```typescript
// ❌ Wrong - key doesn't match
const hotkey = ctx.getRegisteredHotkeys().find(h => h.key === "Mod+S");
// Component registered: "mod+s" (lowercase)

// ✅ Correct
const hotkey = ctx.getRegisteredHotkeys().find(h => h.key === "mod+s");
```

---

### scrollIntoView is not a function (JSDOM)

**Problem:** Tests fail with "scrollIntoView is not a function"

**Solution:** Mock it at the top of test file

```typescript
Element.prototype.scrollIntoView = vi.fn();
```

---

## Current Hotkey Coverage

### Global Hotkeys (App.tsx)
| Hotkey | Action | Test File |
|--------|--------|-----------|
| `Shift+/` (?) | Open help modal | App.hotkeys.test.tsx |
| `Mod+K` | Open command palette | App.hotkeys.test.tsx |

### Layout Hotkeys (Layout.tsx)
| Hotkey | Action | Test File |
|--------|--------|-----------|
| `Ctrl+B` | Toggle sidebar | Layout.hotkeys.test.tsx |
| `Mod+E` | Toggle sidebar (alt) | Layout.hotkeys.test.tsx |
| `Shift+;` (:) | Focus command line | Layout.hotkeys.test.tsx |
| `Escape` | Blur command line | Layout.hotkeys.test.tsx |

### Document Hotkeys (Document.tsx)
| Hotkey | Action | Test File |
|--------|--------|-----------|
| `Mod+S` | Save immediately | Document.hotkeys.test.tsx |
| `Escape` | Handle escape | Document.hotkeys.test.tsx |
| `Mod+C` | Unfocus editor | Document.hotkeys.test.tsx |
| `Enter` | Focus editor | Document.hotkeys.test.tsx |

### Dashboard Hotkeys (Dashboard.tsx)
| Hotkey | Action | Test File |
|--------|--------|-----------|
| `Mod+N` | New document | Dashboard.hotkeys.test.tsx |
| `Mod+Shift+A` | Toggle archived | Dashboard.hotkeys.test.tsx |
| `j` | Select next | Dashboard.hotkeys.test.tsx |
| `k` | Select previous | Dashboard.hotkeys.test.tsx |
| `ArrowDown` | Select next (alt) | Dashboard.hotkeys.test.tsx |
| `ArrowUp` | Select previous (alt) | Dashboard.hotkeys.test.tsx |
| `Enter` | Open selected | Dashboard.hotkeys.test.tsx |
| `Mod+A` | Prepare archive cmd | Dashboard.hotkeys.test.tsx |
| `Mod+U` | Prepare unarchive cmd | Dashboard.hotkeys.test.tsx |

### Projects Hotkeys (Projects.tsx)
| Hotkey | Action | Test File |
|--------|--------|-----------|
| `j` | Select next | Projects.hotkeys.test.tsx |
| `k` | Select previous | Projects.hotkeys.test.tsx |
| `ArrowDown` | Select next (alt) | Projects.hotkeys.test.tsx |
| `ArrowUp` | Select previous (alt) | Projects.hotkeys.test.tsx |
| `Enter` | Select project | Projects.hotkeys.test.tsx |
| `Mod+N` | Queue new command | Projects.hotkeys.test.tsx |
| `Mod+A` | Queue archive command | Projects.hotkeys.test.tsx |
| `Mod+U` | Queue unarchive command | Projects.hotkeys.test.tsx |
| `Mod+R` | Queue rename command | Projects.hotkeys.test.tsx |
| `Mod+D` | Queue delete command | Projects.hotkeys.test.tsx |

### Search Hotkeys (Search.tsx)
| Hotkey | Action | Test File |
|--------|--------|-----------|
| `Tab` | Move to first result | Search.hotkeys.test.tsx |
| `Escape` | Blur search input | Search.hotkeys.test.tsx |
| `j` | Navigate down | Search.hotkeys.test.tsx |
| `k` | Navigate up | Search.hotkeys.test.tsx |
| `/` | Focus search | Search.hotkeys.test.tsx |
| `Enter` | Open result | Search.hotkeys.test.tsx |

### Command Palette Hotkeys (CommandPalette.tsx)
| Hotkey | Action | Test File |
|--------|--------|-----------|
| `Escape` | Close palette | CommandPalette.hotkeys.test.tsx |
| `Ctrl+N` | Next command | CommandPalette.hotkeys.test.tsx |
| `Ctrl+P` | Previous command | CommandPalette.hotkeys.test.tsx |
| `ArrowDown` | Next command (alt) | CommandPalette.hotkeys.test.tsx |
| `ArrowUp` | Previous command (alt) | CommandPalette.hotkeys.test.tsx |
| `Enter` | Execute command | CommandPalette.hotkeys.test.tsx |

### Help Modal Hotkeys (HelpModal.tsx)
| Hotkey | Action | Test File |
|--------|--------|-----------|
| `Escape` | Close help | HelpModal.hotkeys.test.tsx |
| `?` (Shift+/) | Close help | HelpModal.hotkeys.test.tsx |

---

## Test Files Structure

```
frontend/src/__tests__/
├── HOTKEYS_MASTER.test.tsx          # Master coverage tracker (43 hotkeys)
├── App.hotkeys.test.tsx             # Global application hotkeys
├── Layout.hotkeys.test.tsx          # Sidebar and command line
├── Document.hotkeys.test.tsx        # Document editing
├── Dashboard.hotkeys.test.tsx       # Document list navigation
├── Projects.hotkeys.test.tsx        # Project management
├── Search.hotkeys.test.tsx          # Search navigation
├── CommandPalette.hotkeys.test.tsx  # Command palette navigation
└── HelpModal.hotkeys.test.tsx       # Help modal keyboard handlers
```

---

## Performance Benchmarks

- **Total runtime:** ~3 seconds for 36 tests
- **Per-test average:** <100ms
- **Timeout limit:** 5000ms (5 seconds)
- **Coverage:** 43/43 hotkeys (100%)

**TDD Goal:** Keep all tests under 5 seconds to maintain fast feedback loop.

---

## Philosophy: KISS + TDD

This test suite combines **KISS (Keep It Simple, Stupid)** with **TDD (Test-Driven Development)**:

1. **Red → Green → Refactor** - Write failing test, minimal implementation, then improve
2. **Simple** - Tests do one thing and do it well
3. **Focused** - Each test verifies a specific hotkey behavior
4. **Fast** - Quick feedback loop encourages frequent testing
5. **Maintainable** - Clear patterns make it easy to add new tests
6. **Reliable** - No flaky tests, no timing dependencies

**Remember:** Tests are both **verification** AND **documentation** - they prove hotkeys work AND document what they do.

---

## Quick Reference Card

```bash
# TDD Workflow
1. npm run test:hotkeys:watch    # Start watch mode
2. Write failing test             # Red phase
3. Implement minimal code         # Green phase
4. Update HOTKEYS_MASTER.test.tsx # Refactor/document
5. Repeat for next hotkey         # Continue TDD cycle

# Test passes? ✅ Commit and move on!
# Test fails? ❌ Debug and fix immediately!
```
