# Gotchas & Pitfalls

Things to watch out for in this codebase.

## [2026-02-03 21:53]
Testing CSS inline styles (like borderLeftColor, backgroundColor with var(--mode-accent)) is fragile. If the styling implementation changes from inline styles to CSS classes, tests break even though the feature works correctly.

_Context: Found in DocumentList.modeAccent.test.tsx - prefer testing via data attributes or class names instead of inline style values._

## [2026-02-03 21:56]
Testing inline CSS style values like `toHaveStyle({ color: "var(--mode-accent)" })` or `toHaveStyle({ fontSize: "12px" })` is fragile. These tests break when the implementation changes (e.g., switching from inline styles to CSS classes) even though the visual result is correct.

_Context: Found in ContextBar.test.tsx - lines 16-28 test mode icon color and lines 58-67 test specific font sizes. Prefer testing via data attributes, class names, or visual regression tests._

## [2026-02-03 22:04]
Testing synthetic/fake components instead of actual components provides zero confidence about real implementation. If the actual component changes or breaks, these tests will still pass.

_Context: Found in Journal.pageHeader.test.tsx - the test creates a TestComponent that mimics the expected header structure, then tests that fake component. This doesn't verify the actual Journal page header works correctly. Similar pattern seen in Dashboard.pageHeader.test.tsx from Phase 1 audit._
