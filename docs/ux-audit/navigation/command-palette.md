---
type: research
title: Command Palette Documentation
created: 2026-02-01
tags:
  - ux-audit
  - navigation
related:
  - "[[sidebar]]"
  - "[[command-line]]"
  - "[[keyboard-shortcuts]]"
---

# Command Palette

This document details the command palette implementation, all available commands, and their purposes.

## Component Architecture

### Core Files

| File | Purpose |
|------|---------|
| `frontend/src/components/GlobalCommandPalette.tsx` | Global command orchestrator |
| `frontend/src/components/ui/CommandPalette.tsx` | Reusable UI component |
| `frontend/src/App.tsx` | Integration and hotkey setup |
| `frontend/src/hooks/useHotkey.ts` | Hotkey registration hook |
| `frontend/src/contexts/HotkeyContext.tsx` | Global hotkey management |

### Component Hierarchy

```
App.tsx
├── GlobalCommandHotkey component
│   ├── useHotkey hook (mod+K trigger)
│   ├── GlobalCommandPalette
│   │   ├── CommandPalette (UI)
│   │   └── GitErrorDialog
│   └── Router
└── [Other providers]
```

## Opening the Palette

| Platform | Shortcut |
|----------|----------|
| macOS | `Cmd+K` |
| Windows/Linux | `Ctrl+K` |

**Configuration:**
```typescript
useHotkey({
  key: "mod+K",
  handler: () => setIsOpen(true),
  allowInInput: false,
  description: "Open command palette",
});
```

## Available Commands

### Navigation Commands

| ID | Text | Icon | Hint | Action |
|----|------|------|------|--------|
| `nav-dashboard` | Go to Dashboard | LayoutDashboard | "Home" | Navigate to dashboard |
| `nav-projects` | Go to Projects | Folder | "Manage projects" | Navigate to projects |
| `nav-search` | Go to Search | Search | "Find documents" | Navigate to search |
| `nav-journal` | Go to Journal | BookOpen | "Quick notes" | Navigate to journal |
| `nav-settings` | Go to Settings | Settings | "Configure app" | Navigate to settings |

### Document Commands

| ID | Text | Icon | Hint | Action |
|----|------|------|------|--------|
| `new-document` | New Document | FilePlus | "Create new entry" | Navigate to new document page |
| `export-document` | Export Document | FileDown | "Export to markdown" | Export current document to markdown |
| `export-document-pdf` | Export Document to PDF | FileDown | "Export to PDF" | Export current document to PDF |
| `export-project` | Export Project | FileDown | "Export project to markdown" | Export entire project (conditional) |

**Note:** `export-project` only appears when a project is selected.

### Git Commands

| ID | Text | Icon | Hint | Action |
|----|------|------|------|--------|
| `git-sync` | Git Sync | GitCommit | "Fetch, pull, commit, push" | Full sync operation |
| `git-push` | Git Push | CloudUpload | "Push to remote" | Push commits |
| `git-pull` | Git Pull | CloudDownload | "Pull from remote (merge)" | Pull with merge |

**Git Sync Status Handling:**
- `SyncStatusNoChanges`: Info notification - no changes to sync
- `SyncStatusUpToDate`: Info notification - already up to date
- `SyncStatusCommitted`: Success - shows file count committed
- `SyncStatusSynced`: Success - shows file count synced
- `SyncStatusPushFailed`: Warning - push operation failed
- `SyncStatusConflict`: Error - merge conflicts detected

### Context-Specific Commands

#### Toggle Archived Documents
| ID | Text | Icon | Condition |
|----|------|------|-----------|
| `toggle-archived` | Show/Hide Archived Documents | Archive/ArchiveRestore | Dashboard with active project |

The icon and text toggle based on current state.

#### Project Switching
| ID Pattern | Text | Icon | Action |
|------------|------|------|--------|
| `project-{id}` | Switch to {alias} | ArrowRight | Switch project context |

Generates one entry per available project (excluding current).

### Debug Commands

| ID | Text | Icon | Hint | Action |
|----|------|------|------|--------|
| `nav-test` | Open Development Test | Bug | "Debug tools" | Navigate to test page |

## CommandPalette Component API

### Props Interface

```typescript
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCommandSelect: (command: CommandOption) => void;
  commands: CommandOption[];
  placeholder?: string;  // Default: "Type a command..."
}
```

### CommandOption Interface

```typescript
interface CommandOption {
  id: string;
  icon: React.ReactNode;
  text: string;
  hint?: string;         // Subtitle text (also searchable)
  action: () => void;    // Can be async
}
```

## Built-in Keyboard Shortcuts

When the palette is open:

| Shortcut | Action |
|----------|--------|
| `Escape` | Close palette |
| `Arrow Down` | Navigate to next command |
| `Arrow Up` | Navigate to previous command |
| `Enter` | Execute selected command |

Navigation wraps at list boundaries.

## Features

### Search/Filtering
- Real-time filtering as you type
- Searches both command text and hint text
- Case-insensitive matching

### Visual Elements
- Icons for quick visual identification
- Hints displayed as subtitles
- Selected item highlighting

### Technical Details
- Built on [cmdk](https://cmdk.paco.me/) library
- Portal-rendered via Radix UI (renders to document.body)
- Supports async actions (commands can return promises)

## Command Generation

Commands are dynamically generated based on:
- Current project selection
- Current page context
- Available projects list
- Archived documents visibility state

**Dependency triggers for regeneration:**
```typescript
useMemo(() => {
  // Command generation logic
}, [projects, currentProject, currentPage]);
```

## Context Integration

The palette integrates with several React contexts:

| Context | Purpose |
|---------|---------|
| `ProjectContext` | Current project, project list |
| `DocumentContext` | Selected document reference |
| `NotificationContext` | User feedback |
| `DialogContext` | Prevent hotkeys during dialogs |

## Error Handling

- Git errors are parsed and displayed in GitErrorDialog
- Document export validates file paths before proceeding
- Missing document detection triggers user notification
