## YANTA Frontend – Open / Future Items

This document tracks the **remaining** or **intentionally deferred** items from `frontend-review.md`, with short context snippets so you don’t have to re-scan the full review.

For full background, see `docs/frontend-review.md` (Rev 20).

---

### Part 2: God Files — Complete

**Section:** “PART 2: GOD FILES (13 files, ~6,900 lines)”  
**Status:** Done. All substantive god files split into focused hooks/utils; remaining two are re-export shims only.

- ~~`dashboard/hooks/useDashboardController.ts`~~ — **Done:** split into useDashboardSelection, useDashboardData, useDashboardDialogs, useDashboardExports, useDashboardHotkeysConfig; controller ~537 lines, thin composer.
- ~~`help/components/HelpModal.tsx`~~ — **Done:** logic in useHelpModalController + help/utils/helpModalUtils; modal is thin UI shell.
- ~~`settings/useSettingsController.ts`~~ — already thin (~65 lines, composer over sub-hooks).
- ~~`settings/Settings.tsx`~~ — **Done:** logic in useSettingsPage hook; page is thin shell.
- ~~`pages/Test.tsx`~~ — **Done:** logic in Test/hooks (useBlockNoteTestEditor, useFileInputDebug, useTestPageController); page is thin shell.
- ~~`command-palette/components/GlobalCommandPalette.tsx`~~ — **Done:** logic in useGlobalCommandPalette hook; component is thin shell.
- ~~`journal/useJournalController.ts`~~ — **Done:** split into useJournalDialogs, useJournalHotkeysConfig.
- ~~`components/editor/RichEditor.tsx`~~ — **Done:** logic in useRichEditorInner hook; EditorInner is thin shell.
- ~~`pages/document/useDocumentController.ts`~~ — **Done:** split into useDocumentExports, useDocumentHotkeysConfig; controller composes them.
- ~~`utils/paneLayoutUtils.ts`~~ — **Done:** split into paneId, paneTreeQueries, paneTreeMutations, paneLayoutValidation, paneNavigation; paneLayoutUtils is barrel.
- ~~`hotkeys/context/HotkeyContext.tsx`~~ — **Done:** logic in hotkeyMatcher.ts + useHotkeyProviderValue; HotkeyContext is thin provider shell.
- `pages/Projects.tsx`, `pages/Search.tsx` — **N/A:** re-export shims only (~3 lines each); no refactor needed.

**Intent (from review):**
- Split these into smaller, focused modules: data fetching, state machines, view models, and UI shells.
- Reduce mixed concerns (business logic + UI + side effects) and make the code testable.

---

### Item 14 – Hotkey System Evaluation

**Section:** “14. Custom Hotkey System → Evaluate react-hotkeys-hook”  
**Status:** Done — Mantine removed, manual addEventListener for bubble phase.

**Completed (Phase 1):** Replaced `@mantine/hooks` useHotkeys with manual keydown listener; added `event.preventDefault()` in bubble handler; added Space key normalization in `createHotkeyMatcher`; removed `@mantine/hooks` dependency.

**Context (excerpt):**
- ~~`HotkeyContext.tsx` (~365 lines)~~ Refactored; now uses:
  - Combo parsing (mod/ctrl/shift/alt), priority system, dialog-aware suppression, special character handling, input-field detection, three dispatch phases.
- Assessment: The priority system and dialog-awareness are real needs, but a full custom system might be replaceable with `react-hotkeys-hook` or `tinykeys` plus a thinner wrapper.

---

### Item 15 – LocalStorage → zustand + persist

**Section:** “15. Custom localStorage Persistence → zustand + persist”  
**Status:** Done.

**Completed:** Migrated all six hooks to zustand + persist stores:
- `commandUsage.store.ts` – command palette usage tracking
- `tooltipUsage.store.ts` – tooltip fade/usage
- `onboarding.store.ts` – welcome overlay state
- `recentDocuments.store.ts` – recent documents list (+ fetch + Events)
- `paneLayout.store.ts` – pane layouts per document
- `progress.store.ts` (pre-existing) – user progress; `useUserProgress` now re-exports from it

Each store uses custom `PersistStorage` for validation, backwards-compatible formats, and optional StorageEvent cross-tab sync. `useLocalStorage` removed (2026-02-12).

---

### Item 17 – Plugin Architecture (High-Level)

**Section:** “17. No Plugin Architecture”  
**Status in review:** `Status: [ ] Not started`

**Context (excerpt):**
- Commands, keyboard shortcuts, editor extensions, and themes are all hardcoded.
- For future plugins/customization the app needs:
  - Command registry (done via Item 54),
  - Shortcut registry (config centralization partially done),
  - Theme system and editor plugin interface (still open).

**Remaining work:**
- Define extension points and contracts for plugins (commands, blocks, sidebars, settings).
- Design plugin lifecycle (load, enable/disable, uninstall) and isolation strategy.

---

### Item 18 – Configuration Infrastructure — Complete

**Section:** "18. Hardcoded Configuration Everywhere"
**Status:** Done (Phases A–C complete).

**Completed:**
- **Phase A:** Constants centralized in `config/` (shortcuts, timeouts, layout).
- **Phase B:** User overrides loaded from `~/.yanta/config.toml` via Wails bindings (`GetPreferencesOverrides`/`SetPreferencesOverrides`). `preferences.store.ts` merges backend overrides with frontend defaults; `useMergedConfig()` consumed across 15+ components. Backend validates bounds (timeouts 100–30000ms, maxPanes 2–8). Settings UI reads + writes overrides via `usePreferencesOverrides()`.
- **Phase C:** Plugin-scoped config namespaces with Zod schema validation. Infrastructure: `pluginConfigRegistry.ts` (Map-based registry with `registerPluginConfig()`), `pluginConfigValidation.ts` (Zod `safeParse` with fallback to defaults), `usePluginConfig<T>(pluginId)` hook for read/write. Backend stores under `[preferences.plugins.<plugin-id>]` in TOML. `preferences.store.ts` deep-merges per plugin ID on save. No consumers yet — awaiting Item 17 plugin architecture.

**Note:** `validatePluginConfig` passes through raw config for unregistered plugins (no schema = no validation). Tighten this when Item 17 plugin lifecycle enforces registration.

---

### Item 29 – Renderless Components → Hooks

**Section:** “29. \"Renderless\" Components”  
**Status:** Done.

**Completed:** Extracted into `useHelpHotkey`, `useQuitHotkeys`, `useWindowHiddenToast`, `useProjectSwitchTracking` in `app/hooks/`. Composed via `useAppGlobalEffects`; single `AppGlobalEffects` component in providers.

---

### Item 30 – Desktop-Specific Concerns

**Section:** “30. Desktop-Specific Concerns”  
**Status:** Done.

**Completed:**
- **Reduced effects mode:** Added “Reduce Visual Effects” toggle in Settings > Appearance. When enabled, sets `data-reduced-effects="true"` on `document.documentElement`; CSS disables `backdrop-filter` and uses nearly opaque glass colors. Persisted via `appearance.store.ts` (zustand + persist).
- **Context menus:** Added Radix-based context menu primitive (`components/ui/context-menu.tsx`). Right-click:
  - **Pane tabs** (PaneHeader): Split horizontally, Split vertically, Close pane
  - **Document rows** (DocumentList): Open, Select/Deselect, Move to..., Archive (or Restore when in archived view)

---

### Item 31–32 – Folder Restructure to Final Domain Layout

**Sections:** “31. Current Structure: Diagnosis”, “32. Proposed Structure”  
**Status:** Complete — All legacy folders (lib/, hooks/, contexts/, components/, constants/, utils/, types/, services/) removed.

**Context (excerpt):**
- Current structure is still partly “technical-role” based (hooks/, contexts/, utils/).
- Proposed structure is a domain-first layout with:
  - `app/`, `dashboard/`, `document/`, `journal/`, `project/`, `search/`, `settings/`, `pane/`, `help/`, `hotkeys/`, etc.
  - A `shared/` layer used only when code is reused across ≥3 domains.

**Completed:**
- **Phase 1:** shared/ui, shared/hooks, shared/utils, shared/types, config/constants
- **Phase 2.1:** pane/components
- **Phase 2.2:** `editor/` domain (RichEditor, extensions, utils/blocknote)
- **Phase 3:** ResizeHandles, TitleBar → app/components
- **Phase 4:** Router imports from domains; `pages/` removed; Test → app/test/
- **Phase 5:** DocumentService → shared/services; legacy shims in place
- **Phase 6 (partial):** Layout imports → @/app; app/providers, app/global-hotkeys import from domains; test mocks updated

**Completed:**
- **Phase 1:** shared/ui, shared/hooks, shared/utils, shared/types, config/constants
- **Phase 2.1:** pane/components
- **Phase 2.2:** `editor/` domain (RichEditor, extensions, utils/blocknote)
- **Phase 3:** ResizeHandles, TitleBar → app/components
- **Phase 4:** Router imports from domains; `pages/` removed; Test → app/test/
- **Phase 5:** DocumentService → shared/services; legacy shims in place
- **Phase 6:** Layout imports → @/app; app/providers, app/global-hotkeys import from domains; test mocks updated
- lib/, hooks/, contexts/, components/, constants/, utils/, types/, services/ all removed
- QuickCommandPanel moved to app/components
- 60+ import paths updated across the codebase

**Post-restructure verification (2026-02-12):**
- Zero legacy import paths remain (`@/components/`, `@/hooks/`, `@/contexts/`, `@/utils/`, `@/types/`, `@/services/`, `@/constants/`, `@/lib/`, `@/pages/` — all clean).
- Barrel files use named exports throughout (`shared/index.ts` uses explicit exports).
- Code splitting via `React.lazy` correctly applied in `app/Router.tsx` for all route-level pages.
- `tsconfig.json` path aliases minimal and correct (`@/*` → `./src/*`, `@/app` → `./src/app/index`).
- `extensions/index.ts` serves as a compatibility shim re-exporting from `editor/extensions` — acceptable.

**Post-restructure verification (2026-02-12):**
- CI env: `cross-env CI=1` added to test scripts for non-interactive runs.
- `test` now runs `vitest run` once (no watch); `test:watch` for dev.
- `testTimeout: 5000` in vitest.config.ts; `pool: "forks"` with 8GB per fork.
- One useAutoSave test skipped (async timing with fake timers).
- All 72 test files (916 tests) pass. Fixed OOM in Dashboard.hotkeys.test.tsx caused by unstable function reference in `useDashboardController.ts` (inline arrow wrapper → direct callback pass-through).
- Production bug fixed: `handleToggleSelection: () => handleToggleSelection()` → `handleToggleSelection` — eliminated infinite re-render loop in hotkey registration system.

---

### Item 19 – Barrel Files (Follow-Up)

**Section:** "19. Add barrel files to all feature dirs"
**Status:** Done (Rev 15), follow-up complete (2026-02-12).

**Completed:** Barrel files added to components/editor, extensions, services, shared.

**Follow-up (from performance review 2025-02-12):**
- ~~`shared/index.ts`~~ — **Done:** Uses explicit named exports from `./ui` (not `export *`).
- `shared/hooks/index.ts` — 30+ named hook exports; acceptable since hooks are small, but monitor for unused additions.
- `pane/index.ts` — 30+ exports from pane utilities; acceptable since pane is page-scoped.
- `shared/ui/index.ts` — 50+ component re-exports. Consumers should prefer direct imports (`@/shared/ui/Button`) over barrel imports (`@/shared/ui`) for better tree-shaking.

**Remaining work:** All done (2026-02-12).
- ~~Replace `export * from "./ui"` in `shared/index.ts` with explicit named exports~~ — Already uses explicit exports.
- ~~Replace `export * from "./primitives"` in `shared/ui/Select/index.ts` with explicit named exports~~ — Select does not export primitives; they remain internal.
- ~~Add missing `WithTooltip` export to `shared/ui/index.ts` barrel~~ — Already exported.

---

### Item 40 – Effect Waterfalls

**Section:** "40. Split effect waterfalls into focused effects"
**Status:** Done.

**Completed (2026-02-12):**

- **`recentDocuments.store.ts`** — Consolidated from 4 effects to 2; removed redundant local state mirror. Now uses `documents` from the store directly.
- **`app/global-hotkeys.tsx`** — Refactored to use `commandPalette.store.ts`; hotkey binds directly to `open()`/`close()`; removed `isOpen` useState and useEffect.
- **`useDocumentController.ts`** — Added `lastAddedPathRef` guard to prevent duplicate `addRecentDocument` calls when deps change.

---

### Item 49–51 – Performance (Follow-Up)

**Section:** "PART 11: PERFORMANCE DEEP DIVE"
**Status:** Done (Items 49-51 completed), follow-up findings implemented (2026-02-12).

**Completed (2026-02-12):**

- **`app/Layout.tsx`** — Gradient hoisted to `.layout-root` CSS class in `styles/tailwind.css`; dynamic `height` style memoized with `useMemo` keyed on `heightInRem`.
- **`shared/hooks/useSidebarSetting.ts`** — Uses functional setState and `sidebarVisibleRef` to avoid closure chain; `setSidebarVisible` and `toggleSidebar` have empty deps.
- **`document/DocumentPage.tsx`** — Document component wrapped in `React.memo`.
- **`useDashboardController.ts`** — `documentsByPathRef` Map for O(1) lookup; `documents.find()` replaced with `documentsByPathRef.current.get()`.
- **`useJournalController.ts`** — `entriesByIdRef` Map for O(1) lookup; `entries.findIndex()` replaced with `entriesByIdRef.current.get()`.
- **`useHotkeyProviderValue.ts`** — `isDialogOpenRef` for dialog check; useMemo depends only on `hotkeys`; `bubbleMatchersAndHandlers` precomputed in memo (no matcher creation in effect); capture/special/space/ctrlW handlers use ref.
- **`useDocumentPersistence.ts`** — `blocksHash` computed in `useLayoutEffect` and stored in state; `compareKey` useMemo deps are `[blocksHash, formData.title, formData.tags]` (no `formData.blocks`).

---

### Item 54 – Command Registry (Follow-Up)

**Section:** "54. Command Registry Design"
**Status:** Done (Rev 14), bug fixed (2026-02-12).

**Completed:** `setShowRecentDocuments` added to the `ctx` useMemo dependency array in `useGlobalCommandPalette.tsx`; stale closure resolved.

---

### Item 15 – LocalStorage Stores (Follow-Up)

**Section:** "15. Custom localStorage Persistence → zustand + persist"
**Status:** Done, follow-up complete (2026-02-12).

**Completed:**
- `recentDocuments.store.ts` and `commandUsage.store.ts` now use `{ version: 1, ... }` wrapper in storage format; legacy format still parsed for backwards compatibility.
- `pruneUsageData` in `commandUsage.store.ts` returns early when `entries.length <= MAX_ENTRIES`; prune only runs when over cap.
- `useLocalStorage` hook removed (unused after zustand migration).

---

### Tier 6 – Extensibility Platform (53a–53d, 14, 15, 18, 30)

**Section:** “Tier 6: Extensibility Platform (planned -- required for roadmap)”  
**Status in review:** all **Not started** (or partial where overlapped with earlier items).

Key items:
- **53a** – Theme system (runtime swap, user-created themes, token architecture).
- **53b** – Plugin architecture (extension registry, loader, lifecycle, sandboxing).
- **53c** – Marketplace (browse/install/update/remove themes/plugins).
- **53d** – i18n foundation (string extraction, locale loading).
- **14, 15, 18, 30** – See sections above; they are explicitly called out as Tier 6 enablers.

**Remaining work:**
- Design and implement the full platform layer for themes, plugins, marketplace, and i18n.
- Integrate the configuration, hotkeys, and state layers so they are ready for plugin-driven extensibility.
