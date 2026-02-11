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
**Status in review:** `Status: [ ] Not started`

**Context (excerpt):**
- Six hooks (`useCommandUsage`, `useTooltipUsage`, `useUserProgress`, `useOnboarding`, `useRecentDocuments`, `usePanePersistence`) each implement their own load/save/validate/listen boilerplate.
- Recommendation: Replace with a single set of zustand stores using `persist` middleware.

**Remaining work:**
- Design persistent stores for these concerns.
- Migrate hooks to wrappers over the new stores; delete duplicated localStorage code.

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

### Item 18 – Configuration Infrastructure (Phases B–C)

**Section:** “18. Hardcoded Configuration Everywhere”  
**Status in review:** `Status: [x] Partial — refactor/centralize-config (timeouts + layout extracted; Phases B-C pending)`

**Context (excerpt):**
- Phase A: centralize app constants into `config/` (done for shortcuts/timeouts/layout).
- Phase B: load user overrides from a settings file via Wails (not done).
- Phase C: plugin-scoped config namespaces with schema validation (not done).

**Remaining work:**
- Implement user-configurable overrides with persistence and validation.
- Extend config system to support per-plugin namespaces.

---

### Item 29 – Renderless Components → Hooks

**Section:** “29. \"Renderless\" Components”  
**Status in review:** `Status: [ ] Not started`

**Context (excerpt):**
- `HelpHotkey`, `QuitHotkeys`, `WindowEventListener`, `ProjectSwitchTracker` render `null` and exist solely for side effects.

**Remaining work:**
- Extract each into a hook (e.g. `useHelpHotkey`, `useQuitHotkeys`, `useWindowHiddenToast`, `useProjectSwitchTracking`).
- Compose these hooks from a minimal orchestrator instead of multiple `null` components.

---

### Item 30 – Desktop-Specific Concerns

**Section:** “30. Desktop-Specific Concerns”  
**Status in review:** `Status: [ ] Not started`

**Context (excerpt):**
- Good: custom resize handles, Wails event cleanup, background/force quit, custom titlebar.
- Questionable:
  - `backdrop-blur-md` glassmorphism can be GPU-intensive.
  - No native right-click context menu.

**Remaining work:**
- Add fallback styles or a “reduced effects” mode for low-end hardware / problematic compositors.
- Implement a context menu strategy (native or custom) where appropriate.

---

### Item 31–32 – Folder Restructure to Final Domain Layout

**Sections:** “31. Current Structure: Diagnosis”, “32. Proposed Structure”  
**Status in review:** `Status: [ ] Not started` (for the final target layout)

**Context (excerpt):**
- Current structure is still partly “technical-role” based (hooks/, contexts/, utils/).
- Proposed structure is a domain-first layout with:
  - `app/`, `dashboard/`, `document/`, `journal/`, `project/`, `search/`, `settings/`, `pane/`, `help/`, `hotkeys/`, etc.
  - A `shared/` layer used only when code is reused across ≥3 domains.

**Remaining work:**
- Finish extracting all domains to their own top-level folders.
- Remove legacy folders once shims are no longer needed.

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

