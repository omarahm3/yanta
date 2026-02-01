---
type: analysis
title: Command Palette Audit
created: 2026-02-01
tags:
  - ux-audit
  - command-palette
related:
  - "[[command-palette]]"
  - "[[keyboard-shortcuts]]"
  - "[[command-line]]"
  - "[[navigation-friction]]"
  - "[[discoverability-friction]]"
---

# Command Palette Audit

This document provides a deep-dive analysis of the command palette implementation, cataloging all commands, identifying gaps, and assessing keyboard shortcut discoverability.

## Source Files Reviewed

| File | Purpose | LOC |
|------|---------|-----|
| `frontend/src/components/GlobalCommandPalette.tsx` | Global command orchestrator | ~390 |
| `frontend/src/components/ui/CommandPalette.tsx` | Reusable UI component wrapper | ~78 |
| `frontend/src/components/ui/command.tsx` | Low-level cmdk wrapper components | ~172 |
| `frontend/src/App.tsx` | Integration and hotkey setup | ~200 |
| `frontend/src/components/QuickCommandPanel.tsx` | Project-switching quick panel | ~40 |

## Component API Documentation

### CommandOption Interface

```typescript
interface CommandOption {
  id: string;           // Unique identifier for the command
  icon: React.ReactNode; // Lucide icon component
  text: string;         // Display text (also used for search)
  hint?: string;        // Subtitle/description (also searchable)
  action: () => void;   // Handler (can be async)
}
```

### CommandPaletteProps Interface

```typescript
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCommandSelect: (command: CommandOption) => void;
  commands: CommandOption[];
  placeholder?: string;  // Default: "Type a command..."
}
```

### GlobalCommandPaletteProps Interface

```typescript
interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string, state?: Record<string, ...>) => void;
  currentPage?: string;
  onToggleArchived?: () => void;
  showArchived?: boolean;
}
```

### Underlying Library

Built on [cmdk](https://cmdk.paco.me/) via Radix UI primitives:
- `CommandDialog` - Modal wrapper
- `CommandInput` - Search field with ESC badge
- `CommandList` - Scrollable command container
- `CommandItem` - Individual command entry
- `CommandShortcut` - Hint text display
- `CommandEmpty` - No results state

## Complete Command Catalog

### Navigation Commands (Always Available)

| ID | Text | Icon | Hint | Target |
|----|------|------|------|--------|
| `nav-dashboard` | Go to Dashboard | LayoutDashboard | "Home" | `/dashboard` |
| `nav-projects` | Go to Projects | Folder | "Manage projects" | `/projects` |
| `nav-search` | Go to Search | Search | "Find documents" | `/search` |
| `nav-journal` | Go to Journal | BookOpen | "Quick notes" | `/journal` |
| `nav-settings` | Go to Settings | Settings | "Configure app" | `/settings` |
| `nav-test` | Open Development Test | Bug | "Debug tools" | `/test` |

### Document Action Commands (Always Available)

| ID | Text | Icon | Hint | Behavior |
|----|------|------|------|----------|
| `new-document` | New Document | FilePlus | "Create new entry" | Navigate to blank document page |
| `export-document` | Export Document | FileDown | "Export to markdown" | Export current doc to .md file |
| `export-document-pdf` | Export Document to PDF | FileDown | "Export to PDF" | Export current doc to .pdf file |

**Note:** Export commands require an active document; shows error notification if none selected.

### Git Commands (Always Available)

| ID | Text | Icon | Hint | Backend Call |
|----|------|------|------|--------------|
| `git-sync` | Git Sync | GitCommit | "Fetch, pull, commit, push" | `SyncNow()` |
| `git-push` | Git Push | CloudUpload | "Push to remote" | `GitPush()` |
| `git-pull` | Git Pull | CloudDownload | "Pull from remote (merge)" | `GitPull()` |

**Error Handling:** Git errors are parsed via `parseGitError()` and displayed in `GitErrorDialog` modal.

**Sync Status Responses:**
- `SyncStatusNoChanges` → Info: "No changes to sync"
- `SyncStatusUpToDate` → Info: "Already in sync with remote"
- `SyncStatusCommitted` → Success: "Committed N file(s)"
- `SyncStatusSynced` → Success: "Synced N file(s) to remote"
- `SyncStatusPushFailed` → Warning: "Committed locally, but push failed"
- `SyncStatusConflict` → Error: "Merge conflict detected"

### Context-Aware Commands

#### Export Project (Conditional: `currentProject` exists)

| ID | Text | Icon | Hint | Behavior |
|----|------|------|------|----------|
| `export-project` | Export Project | FileDown | "Export project to markdown" | Export all project docs to directory |

#### Toggle Archived (Conditional: Dashboard + `currentProject` + `onToggleArchived`)

| ID | Text | Icon | Condition |
|----|------|------|-----------|
| `toggle-archived` | Show/Hide Archived Documents | Archive/ArchiveRestore | Dashboard with active project |

Icon and text toggle dynamically based on `showArchived` state.

### Dynamic Project Switching Commands

For each project in `projects` (excluding `currentProject`):

| ID Pattern | Text | Icon | Hint | Action |
|------------|------|------|------|--------|
| `project-{id}` | Switch to {alias} | ArrowRight | Project name | `setCurrentProject(project)` |

## Command Generation Analysis

### Dependency Array

Commands regenerate when any of these change:
```typescript
useMemo(() => { ... }, [
  projects,
  currentProject,
  getSelectedDocument,
  setCurrentProject,
  onNavigate,
  onClose,
  currentPage,
  onToggleArchived,
  showArchived,
  notification,
  showGitError,
]);
```

### Generation Logic Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Command Generation                       │
├─────────────────────────────────────────────────────────────┤
│  1. Add static navigation commands (6)                      │
│  2. Add document commands (3)                               │
│  3. Add git commands (3)                                    │
│  4. IF currentProject:                                      │
│     └─ Add export-project command                          │
│  5. IF currentPage === "dashboard" AND onToggleArchived:   │
│     └─ Add toggle-archived command                         │
│  6. FOR each project (excluding current):                   │
│     └─ Add project-switch command                          │
└─────────────────────────────────────────────────────────────┘
```

## Missing Commands for Keyboard-First Workflow

### High Priority - Navigation Gaps

| Missing Command | Rationale | Proposed ID |
|-----------------|-----------|-------------|
| Go to Quick Capture | No palette access to quick capture | `nav-quickcapture` |
| Recent Documents | No quick access to recently edited | `nav-recent` |
| Open Document by Name | Search docs within palette | `open-document` |

### High Priority - Action Gaps

| Missing Command | Rationale | Proposed ID |
|-----------------|-----------|-------------|
| New Journal Entry | Can only create via Quick Capture or Journal page | `new-journal-entry` |
| Focus Command Line | No way to focus `:` input from palette | `focus-commandline` |
| Save Current Document | Must use Ctrl+S, no palette alternative | `save-document` |
| Toggle Sidebar | No keyboard way to collapse/expand sidebar | `toggle-sidebar` |

### Medium Priority - Document Management Gaps

| Missing Command | Rationale | Proposed ID |
|-----------------|-----------|-------------|
| Archive Current Document | Must navigate to dashboard to archive | `archive-document` |
| Delete Current Document | No direct deletion from document view | `delete-document` |
| Duplicate Document | Common operation with no shortcut | `duplicate-document` |
| Move to Project | Relocate document between projects | `move-document` |

### Medium Priority - Git Workflow Gaps

| Missing Command | Rationale | Proposed ID |
|-----------------|-----------|-------------|
| Git Status | View uncommitted changes | `git-status` |
| Git Diff | Preview changes before commit | `git-diff` |
| Discard Changes | Revert uncommitted modifications | `git-discard` |

### Low Priority - Quality of Life

| Missing Command | Rationale | Proposed ID |
|-----------------|-----------|-------------|
| Toggle Theme | Light/dark mode switch | `toggle-theme` |
| Zoom In/Out | Adjust UI scale | `zoom-in` / `zoom-out` |
| Copy Document Link | Share internal reference | `copy-link` |
| Print Document | Export to printer | `print-document` |

## Keyboard Shortcut Discoverability Analysis

### Current Discoverability Mechanisms

#### 1. Help Modal (`Shift+?`)

**Access:** `useHelp()` hook, triggers `HelpModal` component

**Content displayed:**
- Global commands (from `GLOBAL_COMMANDS` constant)
- Page-specific commands (via `setPageContext()`)
- Registered hotkeys (via `getRegisteredHotkeys()`)

**Features:**
- Search/filter functionality
- Category grouping for shortcuts
- Key display formatting (Ctrl, Shift, etc.)

**Limitations:**
- Does not show command palette commands
- Requires user to know about `?` shortcut
- No inline hints in main UI

#### 2. Command Palette Hints

**Location:** Displayed as `<CommandShortcut>` after command text

**Current hints shown:**
| Command | Hint |
|---------|------|
| Go to Dashboard | "Home" |
| Go to Projects | "Manage projects" |
| Go to Search | "Find documents" |
| Go to Journal | "Quick notes" |
| Go to Settings | "Configure app" |
| New Document | "Create new entry" |
| Export Document | "Export to markdown" |
| Export Document to PDF | "Export to PDF" |
| Git Sync | "Fetch, pull, commit, push" |
| Git Push | "Push to remote" |
| Git Pull | "Pull from remote (merge)" |
| Export Project | "Export project to markdown" |
| Toggle Archived | "{alias} context" |
| Switch to {alias} | Project name |

**Critical Gap:** Hints describe actions, **not keyboard shortcuts**. Users cannot discover that `Ctrl+N` creates a document from the palette.

#### 3. Status Bar

**Not currently implemented** - No footer showing context-sensitive shortcuts.

### Discoverability Improvements Needed

#### 1. Show Keyboard Shortcuts in Palette Hints

```
Current:  "New Document" → hint: "Create new entry"
Improved: "New Document" → hint: "Ctrl+N"
```

Commands with shortcuts that should display them:
| Command | Shortcut |
|---------|----------|
| New Document | `Ctrl+N` |
| Go to Search | `Ctrl+F` (if exists) |
| Toggle Archived | `Ctrl+Shift+A` |
| Git Sync | (none currently) |

#### 2. Add Shortcut Badge to Palette Trigger

Current UI has no indication that `Ctrl+K` opens the palette. Users discover it accidentally or from documentation.

**Suggestion:** Add `⌘K` badge to titlebar or sidebar.

#### 3. Onboarding Hints

New users have no introduction to:
- Command palette existence
- Help modal shortcut
- Vim-style `j/k` navigation

#### 4. Context-Sensitive Shortcut Display

Dashboard shows document list but doesn't indicate:
- `Space` to select
- `Enter` to open
- `j/k` to navigate

**Suggestion:** Show shortcut hints in empty state or first-use tooltip.

## Hotkeys Not Accessible via Palette

These keyboard shortcuts exist but have **no command palette equivalent**:

### Application-Level (`App.tsx`)

| Shortcut | Action | In Palette |
|----------|--------|------------|
| `Ctrl+K` | Open command palette | N/A (it IS the palette) |
| `Shift+?` | Toggle help modal | ❌ Missing |
| `Ctrl+Q` | Background quit | ❌ Missing |
| `Ctrl+Shift+Q` | Force quit | ❌ Missing |

### Dashboard-Level (`useDashboardController.ts`)

| Shortcut | Action | In Palette |
|----------|--------|------------|
| `Ctrl+N` | Create new document | ✅ "New Document" |
| `Ctrl+Shift+A` | Toggle archived view | ✅ Conditional |
| `Ctrl+D` | Soft delete selected | ❌ Missing |
| `Ctrl+Shift+D` | Hard delete selected | ❌ Missing |
| `Space` | Toggle selection | ❌ N/A (list interaction) |
| `Enter` | Open highlighted | ❌ N/A (list interaction) |
| `j/k` | Navigate list | ❌ N/A (list interaction) |
| `Ctrl+A` | Archive selected | ❌ Missing |
| `Ctrl+U` | Restore archived | ❌ Missing |
| `Ctrl+E` | Export to markdown | ✅ "Export Document" |
| `Ctrl+Shift+E` | Export to PDF | ✅ "Export Document to PDF" |

### Document-Level (`useDocumentController.ts`)

| Shortcut | Action | In Palette |
|----------|--------|------------|
| `Ctrl+S` | Save document | ❌ Missing |
| `Ctrl+E` | Export to markdown | ✅ Available |
| `Ctrl+Shift+E` | Export to PDF | ✅ Available |
| `Escape` | Navigate back | ❌ N/A (navigation) |
| `Ctrl+C` | Unfocus editor | ❌ N/A (editor) |
| `Enter` | Focus editor | ❌ N/A (editor) |

### Journal-Level (`useJournalController.ts`)

| Shortcut | Action | In Palette |
|----------|--------|------------|
| `Ctrl+N` | Next day | ❌ Missing |
| `Ctrl+P` | Previous day | ❌ Missing |
| `←/→` | Navigate days | ❌ N/A (navigation) |
| `j/k` | Navigate entries | ❌ N/A (list interaction) |
| `Space` | Toggle selection | ❌ N/A (list interaction) |
| `Ctrl+D` | Delete selected | ❌ Missing |
| `Ctrl+Shift+P` | Promote to document | ❌ Missing |

## Summary Statistics

| Category | Count |
|----------|-------|
| Total palette commands | 13-17 (varies by context) |
| Static navigation commands | 6 |
| Document action commands | 3 |
| Git commands | 3 |
| Context-aware commands | 1-2 |
| Dynamic project commands | N (per project) |
| Hotkeys with no palette equivalent | 15+ |
| Missing high-priority commands | 4 |
| Missing medium-priority commands | 6 |

## Recommendations

### Immediate Improvements

1. **Add shortcut hints to palette items** - Show `Ctrl+N` instead of "Create new entry"
2. **Add "Open Help" command** - Let users discover help from palette
3. **Add Quick Capture navigation** - Critical missing navigation target
4. **Add Save command** - Users expect save in command palettes

### Structural Improvements

1. **Group commands by category** - Use `CommandGroup` with headings (Navigation, Documents, Git, etc.)
2. **Add fuzzy search aliases** - "new", "create", "add" should all match "New Document"
3. **Show recent commands** - Track and surface frequently used commands

### Discoverability Improvements

1. **Palette trigger badge** - Show `⌘K` in UI chrome
2. **First-run onboarding** - Tooltip pointing to palette shortcut
3. **Contextual hints** - Show relevant shortcuts in empty states
4. **Unified shortcut view** - Combine palette commands and hotkeys in help modal
