---
type: research
title: Keyboard Shortcuts Documentation
created: 2026-02-01
tags:
  - ux-audit
  - navigation
related:
  - "[[sidebar]]"
  - "[[command-palette]]"
  - "[[command-line]]"
---

# Keyboard Shortcuts

This document catalogs all keyboard shortcuts organized by page and context.

## Key Notation

| Notation | Platform | Key |
|----------|----------|-----|
| `Mod` | macOS | `Cmd` |
| `Mod` | Windows/Linux | `Ctrl` |
| `Shift+/` | All | `?` |
| `Shift+;` | All | `:` |

## Global Shortcuts

Available on all pages throughout the application.

| Shortcut | Action | Category |
|----------|--------|----------|
| `Mod+K` | Open command palette | Navigation |
| `Shift+?` | Toggle help modal | System |
| `Ctrl+Q` | Quit (background if enabled) | System |
| `Ctrl+Shift+Q` | Force quit application | System |

**Source:** `frontend/src/App.tsx`

## Layout Shortcuts

Available on all pages that use the Layout component.

| Shortcut | Action | Category |
|----------|--------|----------|
| `Ctrl+B` | Toggle sidebar | Navigation |
| `Mod+E` | Toggle sidebar | Navigation |
| `Shift+;` (`:`) | Focus command line | Navigation |
| `Escape` | Exit command line | Navigation |

**Source:** `frontend/src/components/Layout.tsx`

## Dashboard Page

### Navigation

| Shortcut | Action | Category |
|----------|--------|----------|
| `j` | Highlight next document | Navigation |
| `k` | Highlight previous document | Navigation |
| `Arrow Down` | Navigate down | Navigation |
| `Arrow Up` | Navigate up | Navigation |
| `Enter` | Open highlighted document | Navigation |
| `Mod+Shift+A` | Toggle archived documents view | Navigation |

### Selection & Editing

| Shortcut | Action | Category |
|----------|--------|----------|
| `Space` | Select/deselect highlighted document | Editing |
| `Mod+N` | Create new document | Editing |
| `Mod+A` | Archive selected documents | Editing |
| `Mod+U` | Restore archived documents | Editing |
| `Mod+D` | Soft delete selected documents | Editing |
| `Mod+Shift+D` | Permanently delete selected documents | Editing |

### Export

| Shortcut | Action | Category |
|----------|--------|----------|
| `Mod+E` | Export selected documents to markdown | System |
| `Mod+Shift+E` | Export selected documents to PDF | System |

**Source:** `frontend/src/pages/dashboard/useDashboardController.ts`

## Document Page

### Editing

| Shortcut | Action | Category |
|----------|--------|----------|
| `Mod+S` | Save document | Editing |
| `Enter` | Focus editor (when unfocused) | Editing |
| `Mod+C` | Unfocus editor | Editing |

### Navigation

| Shortcut | Action | Category |
|----------|--------|----------|
| `Escape` | Navigate back (when editor not focused) | Navigation |

### Export

| Shortcut | Action | Category |
|----------|--------|----------|
| `Mod+E` | Export to Markdown | System |
| `Mod+Shift+E` | Export to PDF | System |

**Source:** `frontend/src/pages/Document/useDocumentController.ts`

## Projects Page

### Navigation

| Shortcut | Action | Category |
|----------|--------|----------|
| `j` | Select next project | Navigation |
| `k` | Select previous project | Navigation |
| `Arrow Down` | Select next project | Navigation |
| `Arrow Up` | Select previous project | Navigation |
| `Enter` | Switch to selected project | Navigation |

### Project Management

| Shortcut | Action | Category |
|----------|--------|----------|
| `Mod+N` | Create a new project | Editing |
| `Mod+A` | Archive a project | Editing |
| `Mod+U` | Restore archived project | Editing |
| `Mod+R` | Rename a project | Editing |
| `Mod+D` | Delete a project | Editing |

**Source:** `frontend/src/pages/Projects.tsx`

## Search Page

### Search Input

| Shortcut | Action | Category |
|----------|--------|----------|
| `/` | Focus search input | Navigation |
| `Tab` | Move focus to first result | Navigation |
| `Escape` | Unfocus search input | Navigation |

### Results Navigation

| Shortcut | Action | Context |
|----------|--------|---------|
| `j` | Navigate down results | When not in search input |
| `k` | Navigate up results | When not in search input |
| `Enter` | Open selected result | When not in search input |

**Source:** `frontend/src/pages/Search.tsx`

## Journal Page

### Date Navigation

| Shortcut | Action | Category |
|----------|--------|----------|
| `Ctrl+N` | Next day | Navigation |
| `Ctrl+P` | Previous day | Navigation |
| `Arrow Right` | Next day | Navigation |
| `Arrow Left` | Previous day | Navigation |

### Entry Navigation

| Shortcut | Action | Category |
|----------|--------|----------|
| `j` | Highlight next entry | Navigation |
| `k` | Highlight previous entry | Navigation |
| `Arrow Down` | Navigate down | Navigation |
| `Arrow Up` | Navigate up | Navigation |

### Entry Management

| Shortcut | Action | Category |
|----------|--------|----------|
| `Space` | Select/deselect highlighted entry | Editing |
| `Mod+D` | Delete selected entries | Editing |
| `Mod+Shift+P` | Promote selected entries to document | Editing |

**Source:** `frontend/src/pages/Journal/useJournalController.ts`

## Settings Page

| Shortcut | Action | Category |
|----------|--------|----------|
| `j` | Navigate to next section | Navigation |
| `k` | Navigate to previous section | Navigation |

**Source:** `frontend/src/pages/Settings.tsx`

## Quick Capture Window

| Shortcut | Action | Category |
|----------|--------|----------|
| `Ctrl+Enter` | Save and close | Editing |
| `Shift+Enter` | Save and keep window open | Editing |
| `Escape` | Close (press twice to confirm discard) | System |

**Source:** `frontend/src/pages/QuickCapture/QuickCapture.tsx`

## Shortcut Categories

Shortcuts are organized into the following categories:

| Category | Description |
|----------|-------------|
| `navigation` | Navigate around the application |
| `editing` | Edit and modify content |
| `search` | Find and filter content |
| `git` | Version control operations |
| `project` | Project management |
| `system` | Application settings and help |
| `general` | Miscellaneous shortcuts |

**Source:** `frontend/src/utils/shortcutCategories.ts`

## Hotkey Infrastructure

### Configuration Interface

```typescript
interface HotkeyConfig {
  key: string;
  handler: (event: KeyboardEvent) => void | boolean;
  allowInInput?: boolean;   // Default: false
  description?: string;
  category?: string;
  priority?: number;
  capture?: boolean;
}
```

### Registration Hooks

| Hook | Purpose |
|------|---------|
| `useHotkey(config)` | Register single hotkey |
| `useHotkeys(configs[])` | Register multiple hotkeys |

**Source:** `frontend/src/hooks/useHotkey.ts`

### Context Provider

`HotkeyContext` provides:
- Central hotkey registration
- Duplicate prevention
- Priority-based execution
- Input field filtering

**Source:** `frontend/src/contexts/HotkeyContext.tsx`

## Implementation Notes

### Vi-Style Navigation
The application follows vi editor conventions:
- `j` = down/next
- `k` = up/previous

This pattern is consistent across Dashboard, Projects, Search, Journal, and Settings pages.

### Input Field Handling
Most shortcuts have `allowInInput: false`, preventing activation while typing in text fields. This prevents interference with normal text entry.

### Event Propagation
Handlers typically call:
- `event.preventDefault()` - Prevent browser default behavior
- `event.stopPropagation()` - Prevent bubbling to other handlers

### Capture vs Bubble Phase
Some shortcuts use capture phase (`capture: true`) to intercept events before they reach other handlers.

### Multi-Selection Workflow
1. Use `j`/`k` to navigate
2. Use `Space` to select/deselect items
3. Use modifier keys (`Mod+A`, `Mod+D`, etc.) for batch operations
4. Use `Escape` to clear selection
