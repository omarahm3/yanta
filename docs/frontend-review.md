# YANTA Frontend Review

**Stack:** React 18 + Tailwind CSS v4 + Radix UI + BlockNote Editor + Wails3 Runtime
**Target:** Cross-platform desktop application (Wails3)
**Last Updated:** 2026-02-07 (Rev 13 — Tier 3: Item 44 toasts, Item 48 TitleBar try/catch, Item 52 drop_console + sourcemap)

---

## Goal

The sole purpose of this restructure is to make the frontend **scalable and extensible**. Every module and feature in YANTA will be heavily changed or rebuilt in the near future. The planned roadmap includes:

- **Custom themes** -- user-created and community-shared color schemes, typography, and layout presets
- **Plugin architecture** -- third-party extensions that add editor blocks, sidebar sections, commands, and integrations
- **Marketplace** -- a storefront for discovering, installing, and managing themes and plugins
- **Deep customization** -- user-configurable keyboard shortcuts, layout options, editor toolbars, and workflow automations
- **i18n** -- full internationalization with community-contributed translations

None of this is possible with the current codebase. Hardcoded commands, scattered configuration, god files mixing 5+ concerns, and no registry/extension-point architecture mean that adding any of these features would require rewriting the same code repeatedly. The restructure invests upfront in domain boundaries, registries, and contracts so that every future feature lands cleanly instead of adding to the debt.

**Every architectural decision in this plan is evaluated against one question: does it make the next plugin/theme/marketplace feature easier to build?**

---

## Overall Impression

Solid TypeScript discipline and some genuinely thoughtful patterns (pane layout reducer, controller hooks, auto-save with backoff). But the codebase shows signs of incremental growth without refactoring -- duplicate code, reinvented npm-solvable problems, 13 god files totaling ~6,900 lines, and no extensibility architecture. The main risk: every new feature will make the spaghetti worse unless the foundation is cleaned up first.

**Grade: C+** -- Good ideas buried under structural debt. Fixable, but needs deliberate investment.

**Production Readiness: 2/5** -- Functional prototype, not production-grade. Missing error resilience, performance guardrails, extensibility contracts, and configuration infrastructure. The path from here to a mature notes app is well-defined but requires systematic work across 12 categories and 55+ items below.

### Target

**Target Grade: A-** -- Clean domain boundaries, centralized config, production error handling, and extensibility contracts ready for themes/plugins/marketplace. Reach this by completing Tiers 1-5, with Tier 6 delivering the platform features.

**Target Production Readiness: 4/5** -- Achieved when:
1. Zero god files over 400 lines (Part 2 items resolved or split)
2. Folder restructure complete through Phase 5 (domains own their code, `app/` shell exists)
3. Every user-initiated async operation surfaces errors via toast (Item 44)
4. Granular error boundaries around editor, settings, and document list (Item 45)
5. No `JSON.stringify` in editor hot path (Item 49)

**Extensibility Readiness: 3/5 → 5/5** -- Achieved when:
6. Command registry exists and domains register commands declaratively (Item 54)
7. Configuration is centralized, validated, and supports plugin-scoped namespaces (Item 55)
8. Keyboard shortcuts are user-rebindable via settings UI (Item 18)
9. Theme token system supports runtime switching and external theme packages (Item 53a)
10. Editor extension registry supports plugin-contributed blocks and toolbars (Item 53b)

---

## PART 1: STRUCTURAL ISSUES

---

### 1. CRITICAL: Duplicated CSS (tailwind.css)

The **entire contents of `tailwind.css` are duplicated**. Lines 1-339 and lines 340-650 are near-identical copies of the same CSS variable declarations, `@theme` blocks, `@layer base`, `@layer components`, and mode-specific styles. Specifically:

- `:root` ShadCN variables: lines 11-44 **and** 345-378
- `.dark` variables: lines 47-79 **and** 381-413
- `@theme inline` block: lines 82-119 **and** 416-453
- `@theme` tokens: lines 121-138 **and** 455-470
- `@layer base`: lines 141-197 **and** 473-505
- Mode-specific focus styles: lines 199-228 **and** 507-540
- `@layer components`: lines 231-339 **and** 543-649

The two `@layer components` blocks **conflict** -- the first has glassmorphism button styles (`bg-glass-bg backdrop-blur-sm`) and the second has simpler styles (`bg-surface`). The second definition wins via cascade, so the first block is dead code.

**Status:** [x] Completed — `refactor/unify-css-theme`

---

### 2. Two Design Systems Fighting (tailwind.css)

Two competing color systems in the same file:

1. **ShadCN/OKLCH system:** `--background`, `--foreground`, `--primary`, `--accent` etc. with light/dark variants
2. **Custom GitHub-dark palette:** `--color-bg: #0d1117`, `--color-surface: #161b22`, `--color-accent: #58a6ff`

Components use a mix of both. The name `--color-accent` maps to `#58a6ff` in `@theme` but to `oklch(0.97 0 0)` (near-white) in the ShadCN `:root`. Different values, same semantic name, same file.

The ShadCN light theme (`:root`) is dead code -- the app is dark-only with no theme toggle. That's ~70 lines of unused CSS variables.

**Status:** [x] Completed — `refactor/unify-css-theme`

---

### 3. Provider Pyramid (App.tsx:257-289)

~~11~~ 8 nested context providers (Scale, Dialog, TitleBar → Zustand):

```
ToastProvider >
HotkeyProvider > HelpProvider > ProjectProvider > UserProgressProvider >
DocumentCountProvider > DocumentProvider > PaneLayoutProvider
```

Problems:
- **Re-render cascades** -- no `React.memo` on any page component
- **Coupling through position** -- provider order encodes implicit dependencies
- **Testing friction** -- unit testing requires 11 providers or a test harness

**Recommendation:** Zustand (~1KB, no providers) for global state. Keep context only for hierarchical concerns.

**Provider-to-replacement mapping:**

| Provider | Replacement | Rationale |
|----------|-------------|-----------|
| ~~`ScaleProvider`~~ | ~~`shared/stores/scale.store.ts` (zustand)~~ — **Done** | Replaced; `useScale` re-exported from contexts |
| ~~`DialogProvider`~~ | ~~`shared/stores/dialog.store.ts` (zustand)~~ — **Done** | Replaced; `useDialog` re-exported; no-op `DialogProvider` for tests |
| `ProjectProvider` | `shared/stores/project.store.ts` (zustand) | Global state, used by 5+ domains |
| `UserProgressProvider` | `shared/stores/progress.store.ts` (zustand) | Global gamification state |
| `DocumentCountProvider` | Merge into `document.store.ts` (zustand) | Simple counter, doesn't need its own context |
| ~~`TitleBarProvider`~~ | ~~`app/stores/titlebar.store.ts` (zustand)~~ — **Done** | Replaced; `useTitleBarContext` re-exported; no-op provider for tests |
| `HelpProvider` | Keep as context OR move to zustand | Low-traffic, either works |
| `ToastProvider` | **Keep as context** | Radix-based, needs portal/tree position |
| `HotkeyProvider` | **Keep as context** | Needs React tree for registration/cleanup lifecycle |
| `DocumentProvider` | **Keep as context** | Hierarchical -- different per pane |
| `PaneLayoutProvider` | **Keep as context** | Hierarchical -- tree structure matters |

**Status:** [~] In progress — Scale, Dialog, TitleBar migrated to Zustand. Remaining: Project, UserProgress, DocumentCount, Help (optional).

---

### 4. God Component (App.tsx:67-176)

~~App.tsx god component~~ — **Partially addressed (Rev 10):** App.tsx slimmed to ~38 lines (error handlers only); provider tree moved to `app/providers.tsx`; hotkey/shell logic moved to `app/global-hotkeys.tsx`. The remaining coupling is inside **GlobalCommandHotkey** (~100+ lines), which still owns:
- Command palette open/close + dialog context sync
- All app navigation state (`currentPage`, `navigationState`, `handleNavigate`)
- Archive/sidebar toggle registration
- 3 hotkey registrations
- Renders both `GlobalCommandPalette` and `Router`

**Follow-up:** ~~Extract `useAppNavigation`~~ — Done (Rev 11): `app/useAppNavigation.ts` holds navigation state and handlers; GlobalCommandHotkey only registers hotkeys and composes palette + Router.
**Status:** [x] Follow-up done — useAppNavigation extracted; optional: have providers import from domains directly instead of legacy barrels

---

### 5. Custom Routing (Router.tsx)

Manual routing via `currentPage` string + `navigationState` object. No URL sync, no history stack, no back/forward, no deep linking.

The type `Record<string, string | number | boolean | undefined>` is repeated **20 times** across the codebase instead of using a shared type. The `page` parameter is typed as `string` in many callsites despite a union type existing in Router.tsx.

**Status:** [ ] Not started

---

### 6. Mixed State Communication Patterns

Three incompatible patterns used simultaneously:

1. **React Context** (10+ providers) -- persistent state
2. **`window.dispatchEvent` / `CustomEvent`** -- `"yanta:document:save"`, `"yanta:force-navigate"` etc.
3. **Ref-based handler registration** (`toggleArchivedRef`, `toggleSidebarRef`) -- imperative parent-to-child

Pattern #2 bypasses React's data flow entirely. Invisible to DevTools, untyped at subscription site, hard to trace.

**Status:** [ ] Not started

---

## PART 2: GOD FILES (13 files, ~6,900 lines)

Every controller hook mixes business logic, UI state, command handling, and data fetching. This is the primary maintainability blocker.

| File | Lines | Mixed Concerns |
|------|-------|---------------|
| `pages/dashboard/useDashboardController.ts` | 789 | Document CRUD + command parsing + selection state + UI state + dialog management + export |
| `components/ui/HelpModal.tsx` | 664 | Help content + search + keyboard nav + command categorization + expandable sections |
| `pages/settings/useSettingsController.ts` | 655 | 15+ useState calls: git config + backup + reindexing + hotkeys + migration + system info |
| `pages/Test.tsx` | 624 | Test page with extensive logic |
| `components/GlobalCommandPalette.tsx` | 607 | Command palette UI + document export + git operations + navigation + icon selection + usage tracking |
| `pages/Projects.tsx` | 497 | Project listing + mutations (TS type errors fixed Rev 9) |
| `pages/Search.tsx` | 470 | Search logic + UI + tagging |
| `components/editor/RichEditor.tsx` | 458 | Editor init + plugins + content handling |
| `pages/Journal/useJournalController.ts` | 455 | Journal logic + command handling |
| `pages/Settings.tsx` | 444 | Settings page + child sections |
| `pages/document/useDocumentController.ts` | 442 | Document state + UI orchestration |
| `utils/paneLayoutUtils.ts` | 416 | Pane layout tree operations |
| `contexts/HotkeyContext.tsx` | 365 | Hotkey registration + 3 dispatch phases + priority system |

**Status:** [ ] Not started

---

## PART 3: DRY VIOLATIONS

---

### 7. Copy-Pasted localStorage Pattern (6 hooks)

Six hooks implement the **identical** boilerplate: `loadData()` with JSON.parse + validation, `saveData()` with try/catch + console.error, `useEffect` with `StorageEvent` listener, `useState` with lazy initializer.

**Affected hooks:**
- `hooks/useCommandUsage.ts` (lines 19-96)
- `hooks/useTooltipUsage.ts` (lines 27-82)
- `hooks/useUserProgress.ts` (lines 31-85)
- `hooks/useOnboarding.ts` (lines 29-87)
- `hooks/useRecentDocuments.ts` (lines 22-70)
- `hooks/usePanePersistence.ts` (lines 21-122)

Example of the identical save pattern in every file:
```typescript
function saveXxx(data: XxxRecord): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
        console.error("[useXxx] Failed to save to localStorage:", err);
    }
}
```

Example of the identical storage listener in every file:
```typescript
useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
            setData(loadXxx());
        }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
}, []);
```

**Fix:** Generic `useLocalStorage<T>(key, schema, options)` hook or adopt zustand with `persist` middleware.

**Status:** [x] Completed — `refactor/generic-localstorage`

---

### 8. Duplicated Tooltip Components

`ShortcutTooltip.tsx` and `WithTooltip.tsx` are **near-identical files** sharing:
- Same imports (React, createPortal, useTooltipUsage, cn)
- Same constants (`HOVER_DELAY = 500`, `FOCUS_DELAY = 800`, `TOOLTIP_OFFSET = 8`)
- Same `TooltipPlacement` type definition
- Same `TooltipPosition` interface
- Same `calculatePosition()` function (~70 lines each)
- Same `parseShortcut()` helper
- Same `useEffect` for `prefers-reduced-motion`
- Same `useEffect` for position updates with scroll/resize listeners
- Same timeout cleanup pattern

These should be a single component or share a `useTooltipPositioning` hook. Better yet, replace both with `@radix-ui/react-tooltip` (already using Radix elsewhere).

**Status:** [x] Completed — `refactor/radix-tooltip`

---

### 9. Navigation State Type Repeated 20 Times

`Record<string, string | number | boolean | undefined>` is copy-pasted in 20 locations:

- `App.tsx:82, 89`
- `components/pane/PaneNavigateContext.tsx:6`
- `components/pane/PaneContent.tsx:73`
- `components/pane/PaneDocumentView.tsx:18`
- `components/pane/PaneLayoutView.tsx:10, 28`
- `components/document/DocumentErrorState.tsx:7`
- `components/GlobalCommandPalette.tsx:57`
- `components/Router.tsx:20` (defines it as `NavigationState` but doesn't export for reuse)
- `pages/Dashboard.tsx:11`
- `pages/Document.tsx:7`
- `pages/Search.tsx:36`
- `pages/Journal/Journal.tsx:12`
- `pages/Journal/useJournalController.ts:63`
- `pages/dashboard/useDashboardController.ts:71`
- `pages/dashboard/useDashboardCommandHandler.ts:18`
- `pages/document/useDocumentController.ts:26`
- `hooks/useDocumentPersistence.ts:23`
- `hooks/useSidebarSections.ts:7`
- Tests: `App.navigation.test.tsx:22`, `shortcuts-global-navigation.test.tsx:65`

**Fix:** Export from `types/navigation.ts`, import everywhere.

**Status:** [x] Completed — `refactor/shared-navigation-types` (NavigationState + PageName exported; imports updated codebase-wide)

---

### 10. Duplicated useRef Sync Pattern (Pane components)

Three pane components copy-paste the same ref synchronization:

```typescript
const { isDialogOpen } = useDialog();
const activePaneIdRef = useRef(activePaneId);
activePaneIdRef.current = activePaneId;
const layoutRef = useRef(layout);
layoutRef.current = layout;
const isDialogOpenRef = useRef(isDialogOpen);
isDialogOpenRef.current = isDialogOpen;
```

Found in: `PaneContent.tsx:29-34`, `PaneDocumentView.tsx:37-44`, `PaneLayoutView.tsx:24-25`

**Fix:** `useLatestRef(value)` utility hook (one-liner, or use `usePrevious` from @mantine/hooks).

**Status:** [x] Completed — `hooks/useLatestRef.ts` added; PaneContent, PaneDocumentView, PaneLayoutView refactored to use it (Rev 7)

---

### 11. Duplicated ESC Key Handler Pattern

Three components implement nearly identical ESC key handling with dialog-awareness:
- `components/pane/PaneContent.tsx:36-54`
- `components/pane/PaneDocumentView.tsx:46-61`
- `components/WelcomeOverlay.tsx:50-65`

All follow: check `e.key === "Escape"` → check `isDialogOpenRef.current` → check pane/component state → `preventDefault` + `stopPropagation`.

**Fix:** Could be handled by the existing HotkeyContext with proper priority, or extract a `useEscapeHandler` hook.

**Status:** [x] Completed — `hooks/useEscapeHandler.ts` added (dialog-aware, uses refs for stable subscription); PaneContent and PaneDocumentView refactored to use it; direct imports in pane components per bundle-barrel-imports (Rev 7)

---

### 12. Duplicated Date Formatting (dateUtils.ts)

`formatRelativeTime()` and `formatRelativeTimeFromTimestamp()` implement the same logic twice (one takes a string, one takes a number). Both manually compute `diffMs → diffSec → diffMin → diffHour → diffDay` when `date-fns` (already in package.json) provides `formatDistanceToNow()` and `format()`.

**Fix:** Replace with `date-fns` calls. Already a dependency.

**Status:** [x] Completed — `refactor/date-fns-cleanup` (bundled into `refactor/shared-navigation-types` PR; `dateUtils.ts` replaced with `date-fns` wrappers)

---

## PART 4: REINVENTED WHEELS

---

### 13. Custom Tooltip System → @radix-ui/react-tooltip

`WithTooltip.tsx` (374 lines) and `ShortcutTooltip.tsx` (~350 lines) hand-roll tooltip positioning, viewport boundary detection, hover/focus delays, and portal rendering. Already using 6 other Radix primitives but not `@radix-ui/react-tooltip`.

**Replace with:** `@radix-ui/react-tooltip` -- handles positioning, portals, delays, accessibility out of the box. Keep the usage-tracking wrapper as a thin layer on top.

**Status:** [x] Completed — `refactor/radix-tooltip`

---

### 14. Custom Hotkey System → Evaluate react-hotkeys-hook

`HotkeyContext.tsx` (365 lines) implements:
- Keyboard combo parsing (mod, ctrl, shift, alt)
- Priority-based handler execution
- Dialog-aware suppression
- Special character handling (?, :)
- Input field detection
- Three dispatch phases (bubble, capture, special chars)

Already partially using `@mantine/hooks` useHotkeys but wrapping it heavily.

**Assessment:** The priority system and dialog-awareness are genuinely custom needs. A full replacement isn't trivial. But `react-hotkeys-hook` or `tinykeys` could handle 80% of this with a thinner custom layer on top.

**Recommendation:** Evaluate whether `react-hotkeys-hook` + a priority wrapper would reduce the 365-line context to ~100 lines.

**Status:** [ ] Not started

---

### 15. Custom localStorage Persistence → zustand + persist

Six hooks (see #7 above) each implement their own localStorage load/save/validate/listen pattern.

**Replace with:** `zustand` with `persist` middleware. One store definition replaces 6 hooks of boilerplate. Zustand is ~1KB, has built-in localStorage persistence with schema migration, and eliminates the need for context providers for these concerns.

**Status:** [ ] Not started

---

### 16. Custom Date Utils → date-fns (already installed)

`dateUtils.ts` (52 lines) reimplements relative time formatting that `date-fns` already provides:

```typescript
// Current: 52 lines of manual math
formatRelativeTime(dateString)
formatShortDate(dateString)
formatRelativeTimeFromTimestamp(timestamp)

// Replacement: 3 lines
import { formatDistanceToNow, format } from 'date-fns';
formatDistanceToNow(date, { addSuffix: true })
format(date, 'MMM d')
```

**Status:** [x] Completed — `refactor/date-fns-cleanup` (bundled into `refactor/shared-navigation-types` PR; custom `dateUtils.ts` replaced with `date-fns` calls)

---

## PART 5: MODULARITY & EXTENSIBILITY

---

### 17. No Plugin Architecture

The codebase has zero extension points. Everything is hardcoded:
- Commands are hardcoded in `GlobalCommandPalette.tsx` (607 lines of command definitions)
- Keyboard shortcuts are hardcoded in individual components and duplicated in `Settings.tsx` (lines 23-90) for display
- Editor extensions are ad-hoc in `/extensions/` (only 2: link-toolbar, rtl)
- Themes are hardcoded CSS variables with no switching mechanism

For a future plugin/customization system, the app needs:
- **Command registry** -- commands registered declaratively, not as 500 lines inside a useMemo
- **Shortcut registry** -- keyboard bindings defined in one config, not scattered across components
- **Theme system** -- token-based theme that can be swapped at runtime
- **Editor plugin interface** -- for custom blocks, toolbars, etc.

**Status:** [ ] Not started

---

### 18. Hardcoded Configuration Everywhere

Scattered magic values with no centralization:

**Timeouts/delays:**
- `ShortcutTooltip.tsx` and `WithTooltip.tsx`: `HOVER_DELAY = 500`, `FOCUS_DELAY = 800`
- `useAutoSave.ts`: debounce delay, retry delay, max retries
- `useSettingsController.ts:75`: `commitInterval: 10`

**Layout dimensions (Tailwind hardcoded):**
- `max-h-[60vh]`, `max-h-[70vh]`, `max-h-[1000px]` in various modals
- `w-[480px]`, `grid-cols-[200px_auto]` in layouts
- `z-40`, `z-[9999]` with no z-index scale

**Keyboard shortcuts:**
- Defined in component files: `App.tsx`, `useDashboardController.ts`, `useJournalController.ts`, etc.
- Separately hardcoded for **display** in `Settings.tsx:23-90`
- No single source of truth -- if you change a shortcut in the handler, Settings still shows the old one

**Fix:** Create `/config/` directory with `shortcuts.ts`, `timeouts.ts`, `layout.ts`. Shortcuts defined once, consumed by both hotkey registration and settings display.

**Status:** [ ] Not started

---

### 19. Missing Feature Isolation

**Good isolation:**
- `pages/Journal/` -- self-contained (DatePicker, Journal.tsx, useJournalController.ts)
- `pages/QuickCapture/` -- self-contained
- `contexts/` -- proper barrel file

**Poor isolation:**
- ~~`pages/dashboard/` -- no index.ts, split across useDashboardController + useDashboardCommandHandler~~ — **Fixed (Rev 9):** Extracted to `dashboard/` domain with index.ts, components, hooks, tests
- ~~`pages/document/` -- only useDocumentController.ts, no index.ts~~ — **Fixed (Rev 9):** Extracted to `document/` domain with full structure
- `pages/settings/` -- no index.ts, scattered sections (GitSyncSection, BackupSection, GeneralSection)
- `components/editor/` -- no index.ts
- `GlobalCommandPalette.tsx` imports from 5+ utility modules, 6+ contexts, 5+ services

**Cross-feature imports that break isolation:**
- GlobalCommandPalette imports from commandSorting, dateUtils, gitErrorParser, clipboard, documentUtils
- useDashboardController imports from 7 contexts/services

**Fix:** Add barrel files to all feature directories. Keep imports shallow.

**Status:** [ ] Not started

---

### 20. Barrel File Inconsistency

**Have index.ts (15 dirs):** components/, components/document/, components/editor/hooks/, components/pane/, components/ui/, components/ui/Select/, contexts/, constants/, hooks/, pages/, pages/Journal/, pages/QuickCapture/, types/, utils/, extensions/rtl/

**Missing index.ts (4 dirs):** pages/dashboard/, pages/document/, pages/settings/, components/editor/

Inconsistent import patterns result from this -- some paths use `../Journal/` (barrel) vs `../dashboard/useDashboardController` (direct).

**Status:** [ ] Not started

---

## PART 6: PERFORMANCE

---

### 21. No React.memo on Page Components

`Dashboard`, `Settings`, `Search`, `Journal`, `Projects` -- none use `React.memo`. With 11 context providers, any context update re-renders every page and its subtree.

**Status:** [ ] Not started

---

### 22. ~~No Lazy Loading~~ RESOLVED

All pages except Dashboard (correct — it's the initial route) are lazy-loaded via `React.lazy` in `pages/index.ts`. Document, Projects, Settings, Search, Journal, and QuickCapture all use dynamic imports. Suspense boundaries exist in Router and DocumentEditorForm.

**Status:** [x] Already implemented

---

### 23. GlobalCommandPalette useMemo with 16 Dependencies

The command list (`useMemo`) has 16 dependencies and ~500 lines of definitions. Any dependency change rebuilds everything. Should be split into stable command groups individually memoized.

**Status:** [ ] Not started

---

### 24. JSON.stringify for Auto-save Change Detection

`useAutoSave.ts` compares values via JSON serialization. For large BlockNote documents, this is expensive per keystroke (debounced but still). See #49 for the detailed performance analysis and fix options.

**Status:** [ ] Not started

---

### 25. No List Virtualization

Document lists render all items. 500+ documents will lag. Replace with `@tanstack/react-virtual`.

**Status:** [ ] Not started

---

## PART 7: CODE QUALITY

---

### 26. TypeScript Gaps

- `Record<string, string | number | boolean | undefined>` repeated 20x (see #9)
- `page` typed as `string` in many callsites despite union type in Router.tsx
- `as unknown as documentModels.BlockNoteBlock[]` force-cast in DocumentService.ts
- Barrel file inconsistency (see #20)
- Props interfaces scattered in component files, not centralized

**Status:** [ ] Not started

---

### 27. Accessibility Gaps

**Good:** Radix ARIA patterns, sr-only, focus-visible, dialog-aware hotkeys, aria-describedby.

**Missing:**
- No `aria-label` on title bar or resize handles
- No skip-to-content link
- No keyboard focus indicators on document list items
- No `prefers-reduced-motion` handling for sidebar transitions and animations
- Custom scrollbar invisible to assistive technology

**Status:** [ ] Not started

---

### 28. Testing: Minimal

Vitest + Testing Library installed but coverage is thin for ~80+ TS files and 30+ hooks. Most complex logic (pane layout reducer, auto-save state machine, hotkey matcher) lacks tests.

**Status:** [ ] Not started

---

### 29. "Renderless" Components

`HelpHotkey`, `QuitHotkeys`, `WindowEventListener`, `ProjectSwitchTracker` render `null` and exist only for side effects. Could be hooks called from a single orchestrator instead of adding React tree nodes.

**Status:** [ ] Not started

---

### 30. Desktop-Specific Concerns

**Good:** user-select:none, custom resize handles, Wails event cleanup, background/force quit, custom titlebar.

**Questionable:**
- `backdrop-blur-md` glassmorphism is GPU-intensive -- no solid fallback for low-end machines / Linux compositing issues
- No native right-click context menu

**Status:** [ ] Not started

---

## WHAT'S DONE WELL

- Pane layout reducer with immutable tree updates and reference equality optimization
- Controller hook pattern separating logic from presentation
- Auto-save with exponential backoff retry
- CrashBoundary with downloadable crash reports
- Service wrapper layer abstracting Wails bindings
- Biome for linting/formatting (fast, modern choice)
- Vite 7 with manual chunk splitting and correct lazy-loading strategy
- Proper cleanup in all useEffect return functions
- Wails event subscriptions with unsubscribe cleanup
- Dialog-aware hotkey suppression
- PaneContainer components correctly use React.memo (rare bright spot for perf)
- Strict TypeScript config (`strict: true`, bundler module resolution)
- Bundle visualizer configured (`rollup-plugin-visualizer`)

---

## PART 8: FOLDER STRUCTURE & ORGANIZATION

---

### 31. Current Structure: Diagnosis

The current layout is a **"technical-role" structure** -- files grouped by what they ARE (hooks, contexts, utils, types) rather than what they DO (document editing, journal, pane management). This is the default React starter pattern and it breaks down as apps grow.

```
src/
├── components/          # 92 files - flat bag + subdirs
│   ├── ui/              # 43 files - shared primitives (good)
│   ├── document/        # 6 files - document-specific (good)
│   ├── editor/          # 1 file + hooks/ subdir
│   ├── pane/            # 9 files - pane system (good)
│   ├── CrashBoundary.tsx
│   ├── GlobalCommandPalette.tsx  # 607 lines, god file
│   ├── Layout.tsx
│   ├── Router.tsx
│   └── ...6 more loose files
├── contexts/            # 11 files - flat bag, no domain grouping
├── hooks/               # 31 files - flat bag, no domain grouping
├── pages/               # 7 loose + 4 feature subdirs
│   ├── dashboard/       # 2 files, no index.ts
│   ├── document/        # 1 file, no index.ts
│   ├── settings/        # 9 files, no index.ts
│   ├── Journal/         # 6 files (good isolation)
│   ├── QuickCapture/    # 7 files (good isolation)
│   └── ...7 loose page files
├── types/               # 9 files - centralized (good idea, incomplete)
├── utils/               # 18 files - flat bag, no domain grouping
├── services/            # 1 file only
├── config/              # 1 file only (featureFlags.ts)
├── constants/           # 3 files
├── extensions/          # 2 extensions (link-toolbar, rtl)
├── lib/                 # 1 file (utils.ts with cn())
├── styles/              # 5 CSS files
└── assets/              # fonts, images
```

**What's wrong with this:**

1. **hooks/ is a junk drawer** -- 31 hooks with zero domain grouping. `useAutoSave`, `useCommandUsage`, `useDocumentForm`, `useGitStatus`, `useMilestoneHints`, `useOnboarding`, `usePaneHotkeys`, `useRecentDocuments`, `useSidebarSections`, `useTooltipUsage` -- these serve completely different domains but live side-by-side. To find "everything related to documents" you need to grep across hooks/, contexts/, pages/document/, components/document/, services/, types/, and utils/.

2. **contexts/ is a flat bag** -- 11 contexts with no domain grouping. `DialogContext` (UI concern), `ProjectContext` (domain), `PaneLayoutContext` (layout engine), `ScaleContext` (appearance), `UserProgressContext` (gamification) all live together.

3. **utils/ is a flat bag** -- 18 utilities spanning accessibility, blocknote helpers, clipboard, color, command sorting, dates, git error parsing, pane layout math, and shortcut resolution.

4. **types/index.ts is a dumping ground** -- exports domain types (Document, Project, Tag) alongside app-state interfaces (YantaState, SettingsState, VersionInfo) and UI contracts (Filter, Command, NavigationItem). Some types are stale (YantaState references pages that don't match the current Router).

5. **Cross-layer imports break the dependency graph:**
   - `hooks/useNotification.ts` imports from `components/ui/Toast` (hook → component)
   - `hooks/useFooterHints.ts` imports `FooterHint` type from `components/ui/FooterHintBar` (hook → component type)
   - `hooks/useSidebarSections.ts` imports `SidebarSection` type from `components/ui` (hook → component type)
   - `components/pane/PaneDocumentView.tsx` imports from `pages/document/useDocumentController` (component → page)

6. **Inconsistent isolation:**
   - `Journal/` and `QuickCapture/` are self-contained with index.ts (good)
   - `dashboard/`, `document/`, `settings/` are half-structured: controller hooks live there but related types, services, and contexts are elsewhere
   - Editor code is split between `components/editor/`, `extensions/`, `hooks/useDocumentEditor.ts`, `hooks/useDocumentForm.ts`, `utils/blocknote.ts`

7. **services/ has 1 file** -- `DocumentService.ts` wraps Wails bindings for documents, but project, journal, git, settings, and system service calls are made directly from controllers/contexts with no wrapper.

**Status:** [ ] Not started

---

### 32. Target Structure: Flat Domain Folders (VS Code-style)

Architecture used by VS Code, Obsidian, Linear, Figma. Domain folders sit flat under `src/` alongside `shared/` and `app/`. No wrapper directory. Each domain owns everything it needs -- components, hooks, context, utils, types. Shared code lives in `shared/`.

```
src/
├── main.tsx                       # Entry point (stays at root)
│
├── app/                           # App shell -- wiring, layout, routing
│   ├── App.tsx                    # Root component
│   ├── Router.tsx                 # Page routing
│   ├── Layout.tsx                 # Shell (titlebar, sidebar, content)
│   ├── providers.tsx              # Single <AppProviders> composing all providers
│   ├── global-hotkeys.ts          # App-level hotkey registrations (mod+K, ctrl+Q, etc.)
│   ├── CrashBoundary.tsx
│   └── index.ts
│
├── config/                        # ALL configuration -- single source of truth
│   ├── shortcuts.ts               # Every keyboard binding (consumed by hotkeys + settings display)
│   ├── timeouts.ts                # Debounce delays, hover delays, retry config
│   ├── layout.ts                  # Z-index scale, max dimensions
│   ├── feature-flags.ts
│   └── index.ts
│
├── shared/                        # Cross-cutting code used by 3+ domains
│   ├── ui/                        # UI primitives (Button, Input, Modal, Toast, etc.)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Label.tsx
│   │   ├── Heading.tsx
│   │   ├── Text.tsx
│   │   ├── Modal.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── Toast.tsx
│   │   ├── Tooltip.tsx            # Single component replacing WithTooltip + ShortcutTooltip
│   │   ├── LoadingSpinner.tsx
│   │   ├── Toggle.tsx
│   │   ├── Select/
│   │   ├── dialog.tsx             # Radix primitives
│   │   ├── checkbox.tsx
│   │   ├── switch.tsx
│   │   ├── command.tsx            # cmdk primitives
│   │   └── index.ts
│   │
│   ├── hooks/                     # Truly shared hooks
│   │   ├── useLocalStorage.ts     # Generic hook (replaces 6 copy-pasted hooks)
│   │   ├── useLatestRef.ts        # Ref sync helper (replaces 3 copies)
│   │   ├── useAutoSave.ts         # Generic auto-save
│   │   ├── useNotification.ts     # Toast wrapper
│   │   └── index.ts
│   │
│   ├── stores/                    # Zustand stores for global state
│   │   ├── dialog.store.ts        # Replaces DialogContext (counter for open dialogs)
│   │   ├── scale.store.ts         # Replaces ScaleContext
│   │   └── index.ts
│   │
│   ├── types/                     # Types used across 3+ domains
│   │   ├── navigation.ts          # NavigationState, PageName (replaces 20 inline copies)
│   │   ├── document.ts            # Document, DocumentMeta, SaveDocumentRequest
│   │   ├── project.ts             # Project, ExtendedProject, ProjectType
│   │   ├── hotkeys.ts             # HotkeyConfig, RegisteredHotkey
│   │   ├── system.ts              # AppInfo, SystemInfo, DatabaseInfo
│   │   ├── tag.ts                 # Tag
│   │   └── index.ts
│   │
│   ├── utils/                     # Pure functions (no React, no side effects)
│   │   ├── cn.ts                  # className merge (current lib/utils.ts)
│   │   ├── date.ts                # date-fns wrappers (replaces 52-line custom dateUtils)
│   │   ├── color.ts
│   │   ├── clipboard.ts
│   │   ├── accessibility.ts
│   │   └── index.ts
│   │
│   └── services/                  # Wails binding wrappers (one per domain)
│       ├── document.service.ts
│       ├── project.service.ts
│       ├── journal.service.ts
│       ├── git.service.ts
│       ├── system.service.ts
│       ├── export.service.ts
│       └── index.ts
│
├── document/                      # Document editing domain
│   ├── components/
│   │   ├── DocumentContent.tsx
│   │   ├── DocumentEditorForm.tsx
│   │   ├── DocumentEditorActions.tsx
│   │   ├── DocumentErrorState.tsx
│   │   ├── DocumentLoadingState.tsx
│   │   └── MetadataSidebar.tsx    # Moved from shared/ui (single-use)
│   ├── hooks/
│   │   ├── useDocumentController.ts
│   │   ├── useDocumentForm.ts
│   │   ├── useDocumentLoader.ts
│   │   ├── useDocumentPersistence.ts
│   │   ├── useDocumentSaver.ts
│   │   └── useDocumentEscapeHandling.ts
│   ├── context/
│   │   ├── DocumentContext.tsx
│   │   └── DocumentCountContext.tsx
│   ├── DocumentPage.tsx           # Thin page shell
│   └── index.ts                   # Public API
│
├── editor/                        # BlockNote editor (used by document + journal)
│   ├── RichEditor.tsx
│   ├── hooks/
│   │   ├── useBlockNoteMenuPosition.ts
│   │   └── usePlainTextClipboard.ts
│   ├── extensions/
│   │   ├── link-toolbar/
│   │   └── rtl/
│   ├── utils/
│   │   └── blocknote.ts           # Moved from shared utils (editor-specific)
│   ├── styles/
│   │   ├── blocknote-dark.css
│   │   └── blocknote-scale.css
│   └── index.ts
│
├── pane/                          # Multi-pane layout engine
│   ├── components/
│   │   ├── PaneContainer.tsx
│   │   ├── PaneContent.tsx
│   │   ├── PaneDocumentView.tsx
│   │   ├── PaneHeader.tsx
│   │   ├── PaneResizeHandle.tsx   # Extracted from PaneContainer inline
│   │   ├── EmptyPaneDocumentPicker.tsx
│   │   └── PaneLayoutView.tsx
│   ├── hooks/
│   │   ├── usePaneLayout.ts
│   │   ├── usePanePersistence.ts
│   │   └── usePaneHotkeys.ts
│   ├── context/
│   │   ├── PaneLayoutContext.tsx
│   │   └── PaneNavigateContext.tsx
│   ├── utils/
│   │   └── paneLayoutUtils.ts
│   ├── types.ts                   # PaneNode, PaneSplit, PaneLeaf, etc.
│   └── index.ts
│
├── dashboard/                     # Dashboard / document list
│   ├── components/
│   │   ├── DocumentList.tsx
│   │   └── StatusBar.tsx          # Moved from shared/ui (single-use)
│   ├── hooks/
│   │   ├── useDashboardController.ts
│   │   └── useDashboardCommandHandler.ts
│   ├── DashboardPage.tsx
│   └── index.ts
│
├── journal/                       # Journal
│   ├── components/
│   │   ├── DatePicker.tsx
│   │   ├── JournalEntry.tsx
│   │   └── JournalStatusBar.tsx
│   ├── hooks/
│   │   ├── useJournal.ts
│   │   └── useJournalController.ts
│   ├── JournalPage.tsx
│   └── index.ts
│
├── project/                       # Project management
│   ├── components/
│   │   └── NewProjectDialog.tsx   # Moved from shared/ui (single-use)
│   ├── context/
│   │   └── ProjectContext.tsx
│   ├── ProjectsPage.tsx
│   └── index.ts
│
├── search/                        # Search
│   ├── SearchPage.tsx
│   └── index.ts
│
├── settings/                      # Settings
│   ├── sections/
│   │   ├── GeneralSection.tsx
│   │   ├── AppearanceSection.tsx
│   │   ├── ShortcutsSection.tsx
│   │   ├── GitSyncSection.tsx
│   │   ├── BackupSection.tsx
│   │   ├── DatabaseSection.tsx
│   │   ├── LoggingSection.tsx
│   │   └── AboutSection.tsx
│   ├── components/
│   │   ├── GitErrorDialog.tsx     # Moved from shared/ui (single-use)
│   │   ├── GitStatusIndicator.tsx # Moved from shared/ui (single-use)
│   │   ├── MigrationConflictDialog.tsx  # Moved from shared/ui (single-use)
│   │   └── SettingsSection.tsx    # Shared within settings (6 importers, all settings sections)
│   ├── hooks/
│   │   └── useSettingsController.ts
│   ├── SettingsPage.tsx
│   └── index.ts
│
├── command-palette/               # Command palette system
│   ├── GlobalCommandPalette.tsx
│   ├── hooks/
│   │   ├── useCommandRegistry.ts  # Extensible command registration
│   │   ├── useCommandUsage.ts
│   │   └── useCommandSorting.ts
│   ├── utils/
│   │   └── commandPreprocessor.ts
│   └── index.ts
│
├── hotkeys/                       # Hotkey system
│   ├── HotkeyContext.tsx
│   ├── useHotkey.ts
│   └── index.ts
│
├── onboarding/                    # Welcome + milestones + progress tracking
│   ├── components/
│   │   ├── WelcomeOverlay.tsx
│   │   ├── MilestoneHint.tsx
│   │   └── MilestoneHintManager.tsx
│   ├── hooks/
│   │   ├── useOnboarding.ts
│   │   ├── useUserProgress.ts
│   │   └── useMilestoneHints.ts
│   ├── context/
│   │   └── UserProgressContext.tsx
│   └── index.ts
│
├── help/                          # Help system
│   ├── HelpModal.tsx
│   ├── HelpSection.tsx
│   ├── ShortcutSearch.tsx
│   ├── context/
│   │   └── HelpContext.tsx
│   └── index.ts
│
├── quick-capture/                 # Quick capture mode
│   ├── components/
│   │   ├── ProjectPicker.tsx
│   │   ├── QuickEditor.tsx
│   │   └── TagChips.tsx
│   ├── hooks/
│   │   └── useQuickCapture.ts
│   ├── utils/
│   │   └── parser.ts
│   ├── QuickCapturePage.tsx
│   └── index.ts
│
├── styles/                        # Global styles only
│   ├── tailwind.css
│   ├── yanta.css
│   └── resize-handles.css
│
└── __tests__/                     # Integration tests
    └── ...
```

**Status:** [ ] Not started

---

### 33. Why This Structure

**Architecture:** Flat domain folders (VS Code / Obsidian / Linear style). Each domain is a top-level directory under `src/`. No umbrella `features/` or `modules/` wrapper. You open `src/` and immediately see every domain in the app.

**Rule 1: Domain = folder.** Everything for "journal" lives in `src/journal/`. Everything for "pane" lives in `src/pane/`. You never grep 6 directories to understand a domain.

**Rule 2: shared/ earns its place.** Code enters `shared/` only when used by 3+ domains. If it's used by 1-2 domains, it lives in those domain folders. This prevents `shared/` from becoming the new junk drawer.

**Rule 3: Public API via index.ts.** Other domains only import from `@/journal` (resolves to `journal/index.ts`), never from `@/journal/hooks/useJournalController`. Internal structure is private. This is critical for plugins -- a plugin interacts with a domain's public API, never its internals.

**Rule 4: One-way dependency flow.**
```
plugins → app/ → domains → shared/
                    ↓
                  shared/
```
- Domain folders can import from `shared/` but never from each other directly
- `app/` can import from domains and `shared/`
- `shared/` imports only from external packages and bindings
- Cross-domain communication goes through zustand stores in `shared/stores/`
- Future plugins import from domain public APIs and `shared/` -- never reach into domain internals

**Rule 5: Types live where they're owned.** Pane types live in `src/pane/types.ts`. Document types live in `shared/types/document.ts` (used by document, dashboard, journal, pane, search -- 5 domains). Props interfaces stay in component files.

**Rule 6: One service per domain.** Instead of 1 `DocumentService.ts` and raw Wails calls everywhere else, each backend domain gets a thin wrapper in `shared/services/`. These service interfaces become the contracts that plugins use to interact with the backend.

**Rule 7: config/ is the single source of truth.** Keyboard shortcuts defined in `config/shortcuts.ts` are consumed by both `hotkeys/` (for registration) and `settings/` (for display). Change once, updates everywhere. Future: plugins register their own config under namespaced keys (e.g. `config.plugins['my-plugin'].setting`).

**Rule 8: Registries over hardcoding.** Commands, editor extensions, sidebar sections, and theme tokens must use registry patterns. A new command/extension/theme is added by calling `registry.register()`, not by editing a 600-line file. This is the foundation for the marketplace -- installed packages register their contributions on load.

---

### 34. What Moves Where (File Mapping)

**Into `app/`:**
- `App.tsx`, `main.tsx` (stays at root), `Router.tsx`, `Layout.tsx`, `CrashBoundary.tsx`
- `TitleBar.tsx`, `ResizeHandles.tsx` (app shell components, only used by App)
- New: `providers.tsx` (composes all providers in one place)
- New: `global-hotkeys.ts` (extracted from GlobalCommandHotkey god component)

**Into `shared/ui/`:**
- Everything currently in `components/ui/` that has 2+ importers across domains
- REMOVE from shared/ui: `NewProjectDialog` → `project/`, `MigrationConflictDialog` → `settings/`, `GitErrorDialog` → `settings/`, `GitStatusIndicator` → `settings/`, `StatusBar` → `dashboard/`, `MetadataSidebar` → `document/`, `HelpModal` → `help/`, `ShortcutSearch` → `help/`

**Into `shared/hooks/`:**
- `useAutoSave.ts` (used by document + journal)
- `useNotification.ts` (used everywhere)
- New: `useLocalStorage.ts` (replaces 6 copy-pasted hooks)
- New: `useLatestRef.ts` (replaces 3 copy-pasted patterns)

**Into `shared/types/`:**
- `Document.ts`, `Project.ts`, `Tag.ts`, `System.ts` (used by many domains)
- `hotkeys.ts`, `globalHotkeys.ts` (used by hotkeys + settings + help)
- New: `navigation.ts` (NavigationState + PageName, replaces 20 inline copies)
- REMOVE from shared: `PaneLayout.ts` → `pane/types.ts` (only used within pane domain)

**Into `shared/utils/`:**
- `cn.ts` (from lib/utils.ts), `date.ts`, `color.ts`, `clipboard.ts`, `accessibility.ts`
- REMOVE from shared: `blocknote.ts` → `editor/utils/`, `paneLayoutUtils.ts` → `pane/utils/`, `commandSorting.ts` → `command-palette/utils/`, `commandPreprocessor.ts` → `command-palette/utils/`, `shortcutCategories.ts` → `help/utils/` or `config/`, `gitErrorParser.ts` → `settings/utils/`

**Into domain folders (examples):**
- `hooks/useDocumentForm.ts` → `document/hooks/`
- `hooks/useDocumentLoader.ts` → `document/hooks/`
- `hooks/usePaneHotkeys.ts` → `pane/hooks/`
- `hooks/usePanePersistence.ts` → `pane/hooks/`
- `hooks/useGitStatus.ts` → `settings/hooks/`
- `hooks/useOnboarding.ts` → `onboarding/hooks/`
- `hooks/useCommandUsage.ts` → `command-palette/hooks/`
- `hooks/useMilestoneHints.ts` → `onboarding/hooks/`
- `contexts/PaneLayoutContext.tsx` → `pane/context/`
- `contexts/ProjectContext.tsx` → `project/context/`
- `contexts/DocumentContext.tsx` → `document/context/`
- `contexts/UserProgressContext.tsx` → `onboarding/context/`
- `contexts/HelpContext.tsx` → `help/context/`

**DELETE:**
- `EmptyPane.tsx` -- exported but imported by zero files (dead code)
- `lib/` directory -- move `cn()` to `shared/utils/cn.ts`
- `constants/` directory -- merge into `config/` or relevant domain
- Top-level `hooks/`, `contexts/`, `utils/`, `types/`, `services/` -- fully absorbed into domains and shared

---

### 35. Migration Path (Incremental)

This restructure does NOT need to happen in one big bang. Do it incrementally, one phase per session. Each phase leaves the app fully working.

**Phase 1: Create shared/ layer (no domain moves yet)** — Implemented with compatibility layer
1. ~~Create `shared/types/navigation.ts` with `NavigationState` and `PageName`~~ — types/index re-exports from shared
2. ~~Create `shared/hooks/useLocalStorage.ts` (generic hook)~~ — hooks re-export; direct importers updated
3. ~~Create `shared/hooks/useLatestRef.ts`~~ — idem
4. ~~Create `shared/utils/` by moving pure utils from `utils/`~~ — cn, date, color, clipboard, accessibility in shared/utils
5. **Compatibility layer:** Many call sites still consume legacy paths via re-export shims (`lib/utils.ts`, `utils/dateUtils.ts`, `utils/colorUtils.ts`, `utils/clipboard.ts`, `utils/accessibility.ts`). This is intentional for incremental migration; full import migration (call sites importing from `shared/` directly) is not done yet.
6. ~~Delete emptied files from old locations~~ — types/navigation.ts, hooks/useLocalStorage.ts, hooks/useLatestRef.ts removed; utils/* and lib/utils are thin re-exports (shims). **Shim cleanup:** Batch all shim removals in Phase 5 when deleting old top-level directories — one clean sweep; do not migrate high-traffic shims (e.g. cn) in between (avoids 20+ file touches for zero behavioral change).

**Phase 2: Create config/ (centralize scattered constants)** — Done
1. ~~Create `config/shortcuts.ts` -- extract all hardcoded keybindings~~ — Done Rev 8
2. ~~Create `config/timeouts.ts` -- extract all hardcoded delays~~ — timeouts.ts extended with searchDebounceMs, documentPickerFilterDebounceMs, focusRestoreMs, gitErrorDismissMs, helpAnnounceDelayMs, milestoneAnimationMs; consumers updated (Search, EmptyPaneDocumentPicker, GlobalCommandPalette, HelpModal, WelcomeOverlay, MoveDocumentDialog, NewProjectDialog, MilestoneHint; Tooltip, useAutoSave, usePanePersistence, useOnboarding, PaneDocumentView, useDocumentPersistence already used TIMEOUTS)
3. ~~Update consumers to import from config~~ — shortcuts and timeouts consumers use config

**Phase 3: Extract first domain -- journal (already 80% isolated)** — Done
1. ~~Move `pages/Journal/` to `journal/`~~ — Journal, JournalEntry, DatePicker, useJournal, useJournalController and __tests__ moved to `src/journal/`
2. ~~Move journal-related hooks from `hooks/` into `journal/hooks/`~~ — Skipped; hooks kept in `journal/` (useJournal, useJournalController)
3. ~~Create `journal/index.ts` barrel~~ — Done
4. ~~Update imports, verify build passes~~ — pages/index.ts lazy-imports from `../journal`; Router unchanged; build passes

**Phase 4: Extract remaining domains one at a time**
- ~~`quick-capture/` (already isolated, just move)~~ — Done: moved `pages/QuickCapture/` to `quick-capture/`; pages/index.ts and main.tsx updated
- ~~`settings/` (already has subdirectory, consolidate)~~ — Done: moved `pages/Settings.tsx` and `pages/settings/` to `settings/`; pages/index.ts updated
- ~~`pane/` (already has components/pane/, add hooks + context)~~ — Done: created `pane/` with types, utils/paneLayoutUtils, hooks (usePanePersistence, usePaneLayout, usePaneHotkeys), context/PaneLayoutContext; moved from contexts/, hooks/, utils/, types/PaneLayout; components/pane imports from ../../pane
- ~~`document/` (consolidate from 4 current directories)~~ — Done: `document/` domain created with DocumentPage, hooks (useDocumentController, useDocumentForm, useDocumentLoader, useDocumentPersistence, useDocumentSaver, useDocumentEscapeHandling, useDocumentEditor), context (DocumentContext, DocumentCountContext), components (DocumentContent, DocumentEditorForm, DocumentEditorActions, DocumentErrorState, DocumentLoadingState, MetadataSidebar), utils (documentUtils); barrel file exports public API; shims at old locations for backward compatibility
- ~~`dashboard/`~~ — Done: `dashboard/` domain created with DashboardPage, hooks (useDashboardController, useDashboardCommandHandler), components (DocumentList, MoveDocumentDialog, StatusBar — all single-use by dashboard); tests moved alongside code; shims at `pages/Dashboard.tsx`, `pages/dashboard/`, `components/DocumentList.tsx`, `components/MoveDocumentDialog.tsx`, `components/ui/StatusBar.tsx`; pages/index.ts imports Dashboard from `../dashboard`
- ~~`project/`~~ — Done: project context, ProjectsPage, NewProjectDialog in `project/`; shims at contexts, pages, components
- ~~`search/`~~ — Done: SearchPage in `search/`; pages shim
- ~~`command-palette/`~~ — Done: GlobalCommandPalette, useCommandUsage, commandSorting, commandPreprocessor in `command-palette/`; shims at components, hooks, utils
- ~~`hotkeys/`~~ — Done: HotkeyContext, useHotkey in `hotkeys/`; shims at contexts, hooks
- ~~`onboarding/`~~ — Done: WelcomeOverlay, milestones, UserProgressContext in `onboarding/`; shims at components, contexts, hooks
- ~~`help/`~~ — Done: HelpModal, HelpSection, ShortcutSearch, HelpContext in `help/`; shims at components/ui, contexts, hooks

**Phase 5: Create app/ shell**
1. ~~Move App.tsx, Router.tsx, Layout.tsx, CrashBoundary.tsx to `app/`~~ — Done: `app/App.tsx`, `app/Router.tsx`, `app/Layout.tsx`, `app/CrashBoundary.tsx`; shims at `App.tsx`, `components/Router.tsx`, `components/Layout.tsx`, `components/CrashBoundary.tsx` re-export from `app/index`
2. ~~Create `app/providers.tsx` composing all providers~~ — Done
3. ~~Extract global hotkeys from GlobalCommandHotkey into `app/global-hotkeys.ts`~~ — Done: `app/global-hotkeys.tsx` (HelpHotkey, QuitHotkeys, GlobalCommandHotkey, WindowEventListener, ProjectSwitchTracker)
4. Delete emptied `pages/`, `components/`, `contexts/`, `hooks/` directories — *Deferred:* legacy barrels kept for backward compatibility; full cleanup in a later phase
5. **Domain imports:** When legacy barrels are removed, update domains (e.g. journal, quick-capture) to import from `shared/` directly instead of `../hooks`, `../types`, etc.

**Phase 6: Clean up tsconfig paths**
1. ~~Update `@/*` path alias or add domain-level aliases~~ — Done: kept `@/*` → `./src/*`; added explicit `@/app` → `./src/app/index` in tsconfig and Vite (avoids Windows casing with App.tsx)
2. ~~Verify all imports resolve cleanly~~ — main, App shim, and component shims now use `@/app`; tsc + build pass

---

### 36. Import Dependency Violations (Current)

The dependency graph SHOULD be: `app/ → domain folders → shared/ → (external)`.

**Current violations:**

| From | To | Violation |
|------|----|-----------|
| `hooks/useNotification.ts` | `components/ui/Toast` | Hook → component (should both be in shared/) |
| `hooks/useFooterHints.ts` | `components/ui/FooterHintBar` | Hook imports TYPE from component (type should be in shared/types) |
| `hooks/useSidebarSections.ts` | `components/ui` | Hook imports TYPE from component (same) |
| `components/pane/PaneDocumentView.tsx` | `pages/document/useDocumentController` | Component → page internal (controller should be in document/) |

**Status:** [ ] Not started

---

### 37. Component Reuse Analysis

**Truly shared (5+ importers) -- stay in shared/ui/:**
- `Button` (18 importers)
- `ConfirmDialog` (6 importers)
- `SettingsSection` (6 importers -- but all within settings; consider moving to settings/)

**Moderately shared (2-4 importers) -- stay in shared/ui/:**
- `Label` (3), `Toggle` (3), `Input` (2), `Select` (2), `LoadingSpinner` (2)

**Single-use app-level -- move to app/:**
- `TitleBar`, `ResizeHandles` (only used by App.tsx)

**Single-use domain-specific -- move to domain folder:**
- `NewProjectDialog` → `project/components/`
- `MigrationConflictDialog` → `settings/components/`
- `ShortcutSearch` → `help/`
- `GitErrorDialog`, `GitStatusIndicator` → `settings/components/`
- ~~`StatusBar` → `dashboard/components/`~~ — Done (Rev 9)
- ~~`MetadataSidebar` → `document/components/`~~ — Done (Rev 9, part of document/ extraction)
- `HelpModal`, `HelpSection` → `help/`

**Moved to domain (done):**
- `DocumentList` → `dashboard/components/` (Rev 9, single-use by Dashboard)
- `MoveDocumentDialog` → `dashboard/components/` (Rev 9, single-use by Dashboard)

**Dead code:**
- `EmptyPane` -- exported from barrel, imported by zero files. Delete.

**Status:** [ ] Partial — document/ and dashboard/ single-use components moved; remaining: project/, settings/, help/

---

### 38. Barrel File Rules

**Every domain directory MUST have an index.ts** that exports its public API. Internal files are implementation details.

```typescript
// journal/index.ts -- public API
export { JournalPage } from './JournalPage';
// Only export what other domains actually need.
```

**shared/ui/index.ts** exports all primitives (current pattern is fine).

**Never bypass a barrel file from outside the domain.** Inside a domain, direct imports are fine.

```typescript
// GOOD: app/Router.tsx importing journal's public API
import { JournalPage } from '@/journal';

// BAD: dashboard/ reaching into journal's internals
import { useJournalController } from '@/journal/hooks/useJournalController';
```

**Current barrel file gaps (need index.ts):**
- ~~`pages/dashboard/` -- no index.ts~~ — Fixed: `dashboard/index.ts` (Rev 9)
- ~~`pages/document/` -- no index.ts~~ — Fixed: `document/index.ts` (Rev 9)
- `pages/settings/` -- no index.ts
- `components/editor/` -- no index.ts

**Status:** [ ] Not started

---

## PART 9: STATE MANAGEMENT DEEP DIVE

---

### 39. God Hooks — useState Overload

Components and hooks with excessive `useState` calls indicate mixed concerns. These need to be split into focused hooks or migrated to zustand stores.

| File | useState count | What's mixed |
|------|---------------|--------------|
| `pages/settings/useSettingsController.ts:62-101` | **27** | Git config + backup + reindex + migration + scale + hotkeys + platform |
| `pages/Test.tsx:285-293` | 9 | Multi-domain test harness |
| `pages/Search.tsx:41-53` | 8 | Query + results + selection + loading + tags |
| `pages/dashboard/useDashboardController.ts:~100-130` | 6 | Document state + UI + commands |
| `pages/Journal/useJournal.ts` | 6 | Journal entries + dates + state |
| `pages/Projects.tsx` | 6 | Projects + mutations |
| `pages/QuickCapture/useQuickCapture.ts` | 6 | Capture state |
| `contexts/DocumentContext.tsx:23-28` | 6 | Documents + selection + loading |
| `contexts/ProjectContext.tsx:25-29` | 5 | Projects + current + loading |
| `components/ui/NewProjectDialog.tsx` | 6 | Form fields |
| `hooks/useAutoSave.ts:33-36` | 5 | Save state + flags |

**Worst offender:** `useSettingsController` with 27 `useState` calls. Should be split into `useGitSyncSettings`, `useBackupSettings`, `useSystemSettings`, `useAppearanceSettings`, `useMigrationSettings`.

**Status:** [ ] Not started

---

### 40. useEffect Waterfalls

Components with cascading effects where one effect triggers another, causing multiple render cycles:

| File | useEffect count | Risk |
|------|----------------|------|
| `components/editor/RichEditor.tsx` | **9** | Editor init → content tracking → plugin setup → clipboard — cascade chain |
| `pages/document/useDocumentController.ts` | **9** | Loading → init → persistence → restoration → escape — interdependent |
| `pages/dashboard/useDashboardController.ts` | 8 | State management + command handling |
| `pages/Search.tsx:59-289` | **8** | Focus → load tags → debounce → validate index → keyboard nav — waterfall |
| `hooks/useAutoSave.ts` | **7** | Ref sync → value tracking → debounce → blur save → unload save → cleanup |
| `pages/Journal/useJournalController.ts` | 6 | Journal state management |
| `contexts/HotkeyContext.tsx` | 5 | Registration + dispatch phases |
| `components/ui/ShortcutTooltip.tsx` | 5 | Position updates + animations |
| `components/ui/WithTooltip.tsx` | 5 | Position updates + animations |

**Monolithic effect:** `useSettingsController.ts:107-198` — single 91-line effect with 18+ async calls chained. Should be split by domain (git, backup, system).

**Status:** [ ] Not started

---

### 41. Context Value Objects Not Memoized

Context providers create new value objects every render, causing all consumers to re-render even when individual values haven't changed:

**`ProjectContext.tsx:97-106`:**
```typescript
const value: ProjectContextValue = {
    currentProject, setCurrentProject, previousProject,
    switchToLastProject, projects, archivedProjects, loadProjects, isLoading,
};
return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
```
New object reference every render → all `useProjectContext()` consumers re-render.

**`DocumentContext.tsx:106-117`:** Same pattern — inline value object, 10 properties, no `useMemo`.

**`ScaleContext.tsx:42`:** Inline `{{ scale, setScale }}` — same issue.

**Fix:** Wrap context values in `useMemo` with correct dependency arrays. Better: migrate to zustand stores which handle this automatically.

**Status:** [x] Done — All providers now memoize value: ProjectContext, DocumentContext, DocumentCountContext, ScaleContext, TitleBarContext, DialogContext, HelpContext, HotkeyContext, PaneLayoutContext; UserProgressContext receives memoized return from useUserProgress.

---

### 42. useRef as Mutable State — Dual Source of Truth

Several components maintain both `useState` AND `useRef` for the same value, synced via `useEffect`. This creates fragile dual sources of truth:

**`hooks/useAutoSave.ts:38-48`** — 9 refs tracking mutable state (timeouts, counters, flags, value snapshots). Acceptable for performance but hard to debug.

**`pages/Search.tsx:44, 193-195`** — `selectedIndex` state synced to `selectedIndexRef` via effect. Used in keyboard event handler to avoid stale closure. Fragile — if sync effect runs after handler, ref is stale.

**`components/pane/PaneDocumentView.tsx:38-44`** — 5 refs (`layoutRef`, `activePaneIdRef`, `suppressEscapeRef`, `isDialogOpenRef`, `hasRestoredScrollRef`) all synced manually. Exactly the pattern `useLatestRef` would fix. → **Fixed (Rev 7):** PaneContent, PaneDocumentView, PaneLayoutView now use `useLatestRef`.

**`components/pane/EmptyPaneDocumentPicker.tsx:49-53`** — 3 props synced to refs for use in callbacks.

**`components/editor/RichEditor.tsx:181-182, 261`** — Content hash tracked via ref for baseline comparison.

See also #49 (JSON.stringify in hot path) — the ref-based value tracking in `useAutoSave` is the flip side of this problem.

**Status:** [x] Partial — Pane components refactored to `useLatestRef` (Rev 7). Remaining: useAutoSave, Search, EmptyPaneDocumentPicker, RichEditor can adopt in follow-up.

---

### 43. Custom Events — Hidden Data Flow

Only 1 production custom event found, but it represents a pattern that should not grow:

**`GlobalCommandPalette.tsx:267`:**
```typescript
window.dispatchEvent(new CustomEvent("yanta:document:save"));
```

This bypasses React's component tree, is invisible to DevTools, untyped at subscription site, and hard to trace. The existing `Events.On()` pattern for Wails backend events is fine (those originate from Go). But frontend-to-frontend communication should use zustand actions, not `window.dispatchEvent`.

**Status:** [ ] Not started

---

## PART 10: ERROR HANDLING & RESILIENCE

---

### 44. Silent Error Swallowing

Multiple catch blocks that `console.error` and continue, giving the user no feedback that an operation failed:

| File:Line | Operation | What user sees |
|-----------|-----------|----------------|
| `pages/Search.tsx:76-78` | Tag loading failure | Nothing — tags just don't appear |
| `pages/Projects.tsx:60-68` | Document count fetch | Nothing — counts show 0 or stale |
| `pages/QuickCapture/QuickCapture.tsx:40-41` | Project loading | Nothing — empty picker |
| `pages/Journal/useJournal.ts:96-98` | Journal entry fetch | Nothing — empty journal |
| `pages/Journal/useJournalController.ts:155-161` | Date loading | Nothing — dates don't appear |
| `contexts/ProjectContext.tsx:73-74` | Project loading | Nothing — app shows empty state forever |
| `utils/clipboard.ts:80-84, 90-92` | Clipboard operations | Nothing — paste silently fails |

**Fix:** Every user-initiated operation that fails should show a toast notification. Background operations should set error state that components can display.

**Status:** [x] Done (Rev 12) — Toasts added: Search (tags), ProjectsPage (document counts), ProjectContext (load projects), QuickCapture (projects), useJournal (entries), useJournalController (dates). QuickCapture branch in main.tsx wrapped with ToastProvider. Clipboard (shared/utils/clipboard paste/upload) still console-only; optional follow-up.

---

### 45. No Granular Error Boundaries

`CrashBoundary` wraps the entire app in `main.tsx`. A render error in **any** component (editor, settings, search, document list) crashes the entire application.

**Missing error boundaries around:**
- Editor (`RichEditor.tsx`) — most likely to crash (third-party BlockNote + TipTap)
- Settings page — complex async operations during init
- Document list rendering — could fail on malformed data
- Search results — depends on backend query results
- Journal entry list — similar to document list

**Production requirement:** Granular error boundaries per domain that show recovery UI ("Something went wrong in the editor. Click to reload.") without taking down the sidebar, navigation, or other panes.

**Status:** [x] Completed — `GranularErrorBoundary` in `app/GranularErrorBoundary.tsx` with message + "Click to reload" (onRetry remounts via key). Wrapped: Editor (DocumentEditorForm), Settings content, Document list (Dashboard), Search results, Journal entry list.

---

### 46. Debug Console Pollution

Files with 3+ `console.log/error/warn` statements that should be removed or routed through the existing `backendLogger`:

| File | Count | Issue |
|------|-------|-------|
| `hooks/useAutoSave.ts` | **7** | Lines 56, 127, 137, 146, 162, 183 — logs every save cycle |
| `hooks/useDocumentLoader.ts` | 6 | Lines 20, 28, 33, 37, 45, 52 — logs every load |
| `hooks/useDocumentPersistence.ts` | 5 | Lines 62, 97, 100, 105 — logs on every render |
| `pages/settings/useSettingsController.ts` | 7+ | `.catch(err => console.error(...))` chains |
| `contexts/ProjectContext.tsx:86` | 1 | `console.log("Project changed event received:", ev.data)` |

**Note:** `vite.config.ts:43-45` has `drop_console` and `pure_funcs` commented out. Uncommenting would strip console calls in production builds. But better to use the existing `backendLogger` consistently and enable log-level filtering.

**Status:** [x] Completed — Log-level filtering added to `backendLogger` (VITE_LOG_LEVEL / PROD defaults to "warn"); application code in main, App, CrashBoundary, contexts, hooks, pages (document, Search, Journal, Projects, QuickCapture, settings) now uses `BackendLogger.error/warn/info`. Remaining: Test.tsx, LoadingSpinner, RichEditor debug logs, clipboard, blocknote, TitleBar, ResizeHandles, useDocumentForm, useDocumentSaver (optional follow-up).

---

### 47. Race Conditions — No AbortController

Async operations that could return after component unmount or after state has changed:

**`hooks/useDocumentLoader.ts`** — No cancel mechanism. If `documentPath` changes rapidly (e.g., fast pane switching), old request could resolve after new one, showing stale document.

**`pages/Search.tsx:149-157`** — `searchTimeoutRef` cleared but the `Query()` promise has no abort mechanism. Fast typing could result in out-of-order results.

**`pages/Journal/useJournal.ts:80-102`** — `refresh()` async with no cancellation. Rapid date switching could show wrong day's entries.

**`utils/assetUpload.ts`** — Chunked uploads have no cancellation mechanism. A large file upload can't be cancelled once started.

**Fix:** Use `AbortController` for all async data fetching. Cancel in-flight requests in effect cleanup functions.

**Status:** [x] Completed — useDocumentLoader: cancelled flag in effect cleanup so stale load results are ignored. Search: request generation ref; only the latest query updates state. useJournal: refresh(requestId) with refreshRequestIdRef; only the latest refresh updates state. (Backend does not accept AbortSignal; ignore-stale pattern used.)

---

### 48. Window Controls Unprotected

**`components/ui/TitleBar.tsx:38, 42`** — ~~`Window.Minimise()` and `Window.ToggleMaximise()` called with no try/catch~~ — **Done (Rev 12):** Both wrapped in try/catch; toast shown on failure. Frameless check catch uses BackendLogger.
**Status:** [x] Completed

---

## PART 11: PERFORMANCE DEEP DIVE

---

### 49. JSON.stringify in Hot Path — useAutoSave

**`hooks/useAutoSave.ts:124-125`:**
```typescript
const valueChanged = JSON.stringify(value) !== JSON.stringify(lastSavedValueRef.current);
const changedFromInitial = JSON.stringify(value) !== JSON.stringify(initialValueRef.current);
```

This runs in a `useEffect` that fires on every `value` change. For a BlockNote document with 100+ blocks, this serializes the entire document tree **twice** on every keystroke (after debounce). This is the single biggest performance bottleneck in the editor.

**Fix:** Use a structural hash (e.g., the existing `contentHash.ts` utility) or a shallow equality check on block array length + last-modified block. Or use BlockNote's built-in change detection. See also #24 (overview) and #42 (dual source of truth via refs in `useAutoSave`).

**Status:** [ ] Not started

---

### 50. Unmemoized List Renders

Components that `.map()` over arrays without `React.memo` on the list item component:

| File | List | Items rendered | React.memo? |
|------|------|---------------|-------------|
| `components/DocumentList.tsx:92-194` | Document list | All docs | **No** |
| `pages/Journal/Journal.tsx:94-104` | Journal entries | All entries | **No** (JournalEntry not memo'd) |
| `pages/Search.tsx:410-467` | Search results | All results | **No** |
| `pages/Search.tsx:332-342` | Project filter buttons | Up to 10 | **No** |
| `components/GlobalCommandPalette.tsx:203-233` | Command groups | All commands | **No** |
| `components/document/DocumentEditorForm.tsx:93-108` | Tag chips | All tags | **No** |

**Positive finding:** `components/pane/PaneContainer.tsx` correctly uses `React.memo` on `PaneLeafView`, `PaneSplitView`, and `PaneResizeHandle`.

**Fix:** Wrap list item components in `React.memo`. Extract anonymous inline item renders into named memoized components.

**Status:** [ ] Not started

---

### 51. Inline Object/Function Creation in JSX

New object/function references created on every render, breaking memoization:

**Inline style objects:**
- `DocumentList.tsx:96-127` — `borderStyle` and `backgroundStyle` objects created per item per render
- `JournalEntry.tsx:40-45` — Same pattern
- `Layout.tsx:110-114` — Gradient background style
- `QuickCapture.tsx:127-130, 141-147` — `backgroundImage` radial gradient

**Anonymous functions in `.map()` (prevents child memoization):**
- `Search.tsx:338, 353, 421-423` — `onClick={() => ...}` in filter buttons and results
- `DocumentList.tsx:149-151, 161-163` — `onClick` and `onToggleSelection` in list items
- `settings/BackupSection.tsx:139, 145` — restore/delete handlers
- `Journal/DatePicker.tsx:233` — `onClick={() => onSelect(date)}` in calendar
- `pane/EmptyPaneDocumentPicker.tsx:228` — `onClick={() => openItem(item)}`

**Fix:** Hoist constant style objects outside components. Use `useCallback` for event handlers or extract list items into `React.memo` components that receive stable props.

**Status:** [ ] Not started

---

### 52. Bundle Optimization Gaps

**Good:** Vite config has manual chunks for React, BlockNote, and utilities. Pages lazy-loaded (except Dashboard — correct, it's the initial route).

**Gaps:**
- ~~`drop_console: true` is **commented out**~~ — **Done (Rev 12):** Enabled; `pure_funcs` for console.log/info enabled.
- No chunk for Radix UI primitives (6 packages, used across many components)
- No chunk for `lucide-react` (icon library, likely tree-shakes but worth verifying)
- `date-fns` not in manual chunks (large library, should be split or tree-shaken)
- ~~`sourcemap: false`~~ — **Done (Rev 12):** Set to `'hidden'` for production.

**Status:** [x] Partial — drop_console and hidden sourcemaps done; other gaps optional

---

## PART 12: EXTENSIBILITY CONTRACTS

---

### 53. Extensibility Scorecard

These are **planned capabilities**, not aspirational. The roadmap requires custom themes, plugins, a marketplace, deep customization, and i18n. Every system below must reach its target score to support that roadmap.

| System | Current | Target | Why this target | Gap |
|--------|---------|--------|-----------------|-----|
| Commands | 2/5 — hardcoded in component | 5/5 — registry + plugin-contributed commands | Marketplace plugins must register commands without editing core files | Command registry pattern (#54) |
| Themes | 2/5 — CSS-only, no switching | 5/5 — runtime swap, user-created, marketplace-distributed | Custom themes is a planned feature | Theme provider + token system + settings UI |
| Keyboard Shortcuts | 3/5 — runtime registration exists, config hardcoded | 5/5 — fully user-customizable, rebindable in settings | Deep customization requirement | Config (#18) + settings UI + persistence |
| Editor Extensions | 2/5 — only 2 extensions, hardcoded | 5/5 — plugin discovery, loading, marketplace install | Plugin architecture is a planned feature | Extension registry + loader + sandboxing |
| Sidebar | 3/5 — data-driven UI, hardcoded sections | 5/5 — pluggable sections, plugin-contributed | Plugins must add sidebar items | Section registry |
| Services | 4/5 — clean Wails abstraction | 5/5 — interface-based, mockable, plugin-accessible | Plugins need service access | Abstract service interfaces |
| Configuration | 1/5 — almost nothing centralized | 5/5 — centralized, validated, user-overridable, plugin-scoped | Marketplace and plugins need scoped config | `config/` infrastructure + persistence + plugin namespaces |
| i18n | 0/5 — absent | 4/5 — full string extraction, community translation support | i18n is a planned feature | i18n library + string extraction + locale loading |
| Marketplace | 0/5 — absent | 4/5 — browse, install, update, remove themes/plugins | Marketplace is a planned feature | Package format + registry API + install flow + UI |

**Status:** [ ] Not started

---

### 54. Command Registry Design

Current: ~500 lines of `useMemo` inside `GlobalCommandPalette.tsx` with 16 dependencies.

Target:
```typescript
// command-palette/registry.ts
interface CommandDefinition {
    id: string;
    group: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
    shortcut?: ShortcutKey;
    keywords?: string[];
    when?: () => boolean;        // Visibility condition
    execute: () => void | Promise<void>;
}

const registry = createCommandRegistry();
registry.register({ id: 'nav.journal', group: 'Navigation', ... });
registry.register({ id: 'git.sync', group: 'Git', ... });

// Domains register their own commands:
// journal/commands.ts
export function registerJournalCommands(registry: CommandRegistry) {
    registry.register({ id: 'journal.new', ... });
    registry.register({ id: 'journal.today', ... });
}
```

Each domain registers its commands via its `index.ts`. The palette just consumes `registry.getAll()`. Adding a command = adding a `.register()` call, not editing a 600-line file.

**Status:** [ ] Not started

---

### 55. Configuration Infrastructure

Current: 1 feature flag in `config/featureFlags.ts`. Everything else is magic numbers in component files.

Target:
```typescript
// config/index.ts
export const config = {
    ui: {
        tooltipHoverDelay: 500,
        tooltipFocusDelay: 800,
        sidebarWidth: 192,
        scrollDebounceMs: 200,
    },
    editor: {
        autoSaveDebounceMs: 2000,
        autoSaveMaxRetries: 3,
        autoSaveRetryBaseMs: 1000,
    },
    git: {
        defaultCommitIntervalMin: 10,
    },
    features: {
        tooltipHints: import.meta.env.YANTA_ENABLE_TOOLTIP_HINTS === true,
    },
} as const;
```

All hardcoded values extracted. Config importable from anywhere. Future phases:
- **Phase A (current):** Centralize all app constants into `config/`.
- **Phase B:** Load user overrides from a settings file (persisted to disk via Wails).
- **Phase C:** Plugin-scoped config namespaces -- each installed plugin registers its config schema under `config.plugins['plugin-id']`, with validation and defaults. The settings UI auto-generates controls from the schema.

**Status:** [x] Partial — `refactor/centralize-config` (timeouts + layout extracted; Phases B-C pending)

---

## RISKS

Key risks to track during execution:

1. **Restructure import churn.** The folder restructure (Phases 3-5) touches every import path in the codebase. Do each phase in a dedicated branch, run `tsc --noEmit` and the full test suite before merging, and avoid parallel feature work on the same files.

2. **Zustand migration ordering bugs.** Replacing context providers with zustand stores (Item 3) may surface subtle timing issues -- especially around `DialogProvider` (used for hotkey suppression) and `ProjectProvider` (used by 5+ domains). Migrate one provider at a time, starting with the simplest (`ScaleProvider`), and verify hotkey behavior after each swap.

3. **Editor stability during refactor.** `RichEditor.tsx` (458 lines, 9 `useEffect`s) is the most fragile component. BlockNote + TipTap internals are sensitive to lifecycle changes. Wrap the editor in a granular error boundary (Item 45) *before* refactoring editor code, so regressions don't crash the whole app.

4. **Cross-domain import violations during migration.** The halfway state (some domains extracted, some still in `hooks/` / `contexts/`) will temporarily create messy imports. Accept this as transitional debt but enforce the final dependency rules (`app/ → domains → shared/`) via an ESLint `import/no-restricted-paths` rule added in Phase 1.

5. **Test coverage gap.** Most refactored code has no tests (Item 28). Prioritize adding tests for `paneLayoutUtils` (complex tree logic) and `useAutoSave` (state machine) before splitting them, so regressions are caught automatically.

---

## COMPLETED ITEMS

Items already resolved in prior branches. Kept here for reference; removed from the priority table.

| # | Issue | Branch |
|---|-------|--------|
| 1 | Fix duplicated `tailwind.css` | `refactor/unify-css-theme` |
| 2 | Unify color systems | `refactor/unify-css-theme` |
| 7 | Extract generic `useLocalStorage<T>` | `refactor/generic-localstorage` |
| 8 | Merge duplicate tooltip components | `refactor/radix-tooltip` |
| 9 | Create shared `NavigationState` + `PageName` types | `refactor/shared-navigation-types` |
| 12 | Replace dateUtils with date-fns calls | bundled into `refactor/shared-navigation-types` |
| 13 | Replace custom tooltips with @radix-ui/react-tooltip | `refactor/radix-tooltip` |
| 16 | Custom date utils → date-fns | bundled into `refactor/shared-navigation-types` |
| 22 | Lazy loading | Already implemented |
| 46 | Debug console + backendLogger + log-level filtering | Rev 7 — completed (see Item 46 above) |
| 55 | Configuration infrastructure (partial) | `refactor/centralize-config`; Rev 8 — `config/shortcuts.ts` added, all hotkey consumers use it |
| 10 | Extract `useLatestRef` utility hook | Rev 7 — `hooks/useLatestRef.ts`; pane components refactored |
| 11 | Extract `useEscapeHandler` (dialog-aware ESC) | Rev 7 — `hooks/useEscapeHandler.ts`; PaneContent, PaneDocumentView |
| 42 | Extract `useLatestRef` (dual source of truth in panes) | Rev 7 — same as #10; pane adoption done; other call sites optional follow-up |
| — | Phase 4: Extract `document/` domain | Rev 9 — `refactor/frontend-foundation`; DocumentPage, hooks, context, components, utils consolidated |
| — | Phase 4: Extract `dashboard/` domain | Rev 9 — `refactor/frontend-foundation`; DashboardPage, DocumentList, MoveDocumentDialog, StatusBar moved; tests migrated |
| — | Fix `Projects.tsx` TS type errors | Rev 9 — `refactor/frontend-foundation`; widened state types to `Record<string, T \| undefined>` to match API returns |
| — | Phase 4: Extract `project/`, `search/`, `command-palette/`, `hotkeys/`, `onboarding/`, `help/` | Rev 9 — `refactor/frontend-foundation`; all six domains consolidated with shims |
| 4 | God Component follow-up: extract `useAppNavigation` | Rev 12 — `app/useAppNavigation.ts`; GlobalCommandHotkey slimmed to hotkeys + composition |
| 44 | Silent error swallowing → toast notifications (6 of 7 sites) | Rev 12 — Search, Projects, ProjectContext, QuickCapture, useJournal, useJournalController; clipboard optional follow-up |
| 48 | Window controls try/catch (TitleBar.tsx) | Rev 12 — Minimise/ToggleMaximise wrapped; toast on failure; BackendLogger for frameless check |
| 52 | Bundle: drop_console, pure_funcs, sourcemap hidden | Rev 12 — vite.config.ts terserOptions + sourcemap |
| 41 | Context value objects memoized (useMemo in all providers) | Already implemented in codebase |

---

## PRIORITY TABLE (REMAINING WORK)

### Tier 1: Foundation (do before any new features)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| — | *(Tier 1 complete: #10, #11, #42, #46, #55 done)* | — | — |

### Tier 1.5: Folder Restructure (enables all subsequent work)

| Phase | Scope | Effort | Notes |
|-------|-------|--------|-------|
| Phase 1 | Create `shared/` layer (types, hooks, utils) | Medium | No domain moves yet; safe to do first |
| Phase 2 | Create `config/` (centralize shortcuts, timeouts) | Low | Builds on partial work in `refactor/centralize-config` |
| Phase 3 | Extract `journal/` domain (already 80% isolated) | Low | Proof-of-concept for the pattern |
| Phase 4 | Extract remaining domains one at a time | High | 11 domains; do in order listed in Section 35 |
| Phase 5 | Create `app/` shell (App, Router, Layout, providers) | Medium | Final move; deletes old top-level dirs |
| Phase 6 | Clean up tsconfig paths | Low | ~~Done — @/app alias, imports verified~~ |

See Section 35 for detailed steps per phase. Each phase leaves the app fully working.

### Tier 2: Architecture (enables extensibility)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 3 | Replace provider pyramid with Zustand (see provider mapping above) | Simpler state, no re-render cascades | High |
| 41 | ~~Memoize remaining context values (`useMemo` on provider values)~~ — Done | Stops unnecessary re-renders | Low |
| 4 | Extract God Component into proper router + controller | Separation of concerns | Medium |
| 39 | Split `useSettingsController` (27 useState) into 5 focused hooks | Maintainability | Medium |
| 54 | Create command registry for plugin system | Extensible commands | High |
| 18 | Centralize shortcuts config (single source for hotkeys + settings display) | Single source of truth, user-customizable | Medium |
| 6 | Unify state communication (remove window.dispatchEvent) | Consistent data flow | Medium |

### Tier 3: Resilience (production-grade error handling)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 44 | ~~Fix silent error swallowing (7 instances → toast notifications)~~ — Done Rev 12 | User feedback on failures | Low |
| 45 | Add granular error boundaries (editor, settings, document list) | Partial crash recovery | Medium |
| 47 | Add AbortController to async hooks (loader, search, journal) | Prevent race conditions | Medium |
| 48 | ~~Add try/catch to Window controls (TitleBar.tsx)~~ — Done Rev 12 | Prevent unhandled exceptions | Low |
| 52 | ~~Enable `drop_console`, add hidden sourcemaps in vite config~~ — Done Rev 12 | Production build quality | Low |

### Tier 4: Performance (handles scale)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 49 | Replace JSON.stringify in useAutoSave hot path (#24, #42) | Editor responsiveness | Medium |
| 50 | Add React.memo to list item components (6 lists identified) | Re-render reduction | Low |
| 51 | Hoist inline styles/callbacks out of render paths | Memoization effectiveness | Low |
| 21 | Add React.memo on page components (5 pages) | Performance | Low |
| 25 | Add list virtualization (@tanstack/react-virtual) | Performance at 500+ documents | Medium |

### Tier 5: Quality & DX

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 19 | Add barrel files to all feature dirs (4 missing) | Consistent imports | Low |
| 26 | Fix TypeScript gaps (force-casts, loose `string` typing) | Type safety | Low |
| 27 | Fix accessibility gaps (aria-labels, skip-to-content, focus indicators) | Compliance | Medium |
| 28 | Add tests for critical logic (pane reducer, auto-save, hotkey matcher) | Safety net | High |
| 29 | Convert renderless components to hooks | Cleaner React tree | Low |
| 40 | Split effect waterfalls into focused effects | Debuggability | Medium |

### Tier 6: Extensibility Platform (planned -- required for roadmap)

These are not aspirational. The roadmap requires custom themes, plugins, a marketplace, and i18n. Tiers 1-5 build the foundation; Tier 6 delivers the extensibility contracts those features depend on.

| # | Issue | Impact | Effort | Enables |
|---|-------|--------|--------|---------|
| 53a | Theme system -- runtime swap, user-created themes, token architecture | Custom themes, marketplace theme distribution | High | Themes, Marketplace |
| 53b | Plugin architecture -- extension registry, loader, lifecycle, sandboxing | Third-party editor blocks, sidebar sections, commands | Very High | Plugins, Marketplace |
| 53c | Marketplace UI + backend -- browse, install, update, remove themes/plugins | Community ecosystem | Very High | Marketplace |
| 53d | i18n foundation -- string extraction, locale loading, community translations | International users | High | i18n |
| 14 | Evaluate react-hotkeys-hook vs custom 365-line context | Less code, easier plugin keybinding | Medium | Plugin shortcuts |
| 15 | Evaluate zustand+persist to replace remaining localStorage hooks | Less boilerplate, plugin-scoped state | Medium | Plugin state |
| 30 | Desktop hardening (glassmorphism fallback, context menus) | Cross-platform polish | Medium | — |
| 18 | User-rebindable keyboard shortcuts (settings UI + persistence) | Deep customization | Medium | Customization |

---

## NPM PACKAGES TO ADOPT

| Need | Current | Replacement | Size | Priority |
|------|---------|-------------|------|----------|
| State management | 11 React contexts | `zustand` | ~1KB | High (Tier 2) |
| localStorage persistence | 6 custom hooks | `zustand/middleware` persist | included | High (Tier 6, evaluate) |
| List virtualization | None | `@tanstack/react-virtual` | ~3KB | Medium (Tier 4) |
| Hotkeys (evaluate) | Custom 365-line context | `react-hotkeys-hook` | ~3KB | Low (Tier 6) |
| Theme switching (future) | None | CSS variable system + zustand | ~0KB | Future |
| i18n (future) | None | `react-i18next` | ~10KB | Future |

**Already adopted:** `@radix-ui/react-tooltip` (Tier 1, done), `date-fns` (already installed, now used).

**Rule: if it can be done with an npm package, do it with an npm package.**
