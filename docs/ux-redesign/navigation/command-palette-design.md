---
type: architecture
title: Command Palette Design
created: 2026-02-01
tags:
  - ux-redesign
  - navigation
  - command-palette
related:
  - "[[mental-model]]"
  - "[[quick-access]]"
  - "[[command-palette-audit]]"
  - "[[discoverability-friction]]"
  - "[[adr-001-command-palette-first]]"
---

# Command Palette Design

This document defines the redesigned command palette as the primary navigation interface for YANTA. It addresses the friction points identified in the UX audit and establishes the command-palette-first paradigm.

---

## Design Philosophy

The command palette is the **single source of truth** for all user actions in YANTA. Every action that can be performed via keyboard shortcut, menu, or button should have a corresponding command palette entry. This creates:

1. **Discoverability** - Users can find any action by searching the palette
2. **Learnability** - Keyboard shortcuts shown in palette help users memorize them
3. **Consistency** - One unified interface for all commands
4. **Accessibility** - Keyboard-first design benefits all users

---

## Command Groupings

Commands are organized into logical groups that appear as sections within the palette. Groups provide visual hierarchy and aid discoverability.

### Group 1: Navigation

Commands for moving between pages/views.

| ID | Text | Icon | Shortcut | Description |
|----|------|------|----------|-------------|
| `nav-dashboard` | Go to Dashboard | `LayoutDashboard` | - | Navigate to document list |
| `nav-projects` | Go to Projects | `Folder` | - | Manage projects |
| `nav-search` | Go to Search | `Search` | `Ctrl+Shift+F` | Search all content |
| `nav-journal` | Go to Journal | `BookOpen` | `Ctrl+J` | View daily notes |
| `nav-settings` | Go to Settings | `Settings` | `Ctrl+,` | App configuration |
| `nav-today` | Jump to Today's Journal | `Calendar` | `Ctrl+T` | Today's journal entries |
| `nav-recent` | Recent Documents | `Clock` | `Ctrl+E` | Recently opened documents |

**Group Header:** "Navigation"

### Group 2: Create

Commands for creating new content.

| ID | Text | Icon | Shortcut | Description |
|----|------|------|----------|-------------|
| `create-document` | New Document | `FilePlus` | `Ctrl+N` | Create document in current project |
| `create-document-here` | New Document in [Project] | `FilePlus` | - | Context: shows current project name |
| `create-journal-entry` | New Journal Entry | `BookPlus` | `Ctrl+Shift+N` | Open quick capture for current project |

**Group Header:** "Create"

### Group 3: Document Actions

Commands for manipulating the current document. Context-aware: only visible when a document is open or selected.

| ID | Text | Icon | Shortcut | Description |
|----|------|------|----------|-------------|
| `save-document` | Save Document | `Save` | `Ctrl+S` | Save current document |
| `export-markdown` | Export to Markdown | `FileDown` | `Ctrl+E` | Export as .md file |
| `export-pdf` | Export to PDF | `FileText` | `Ctrl+Shift+E` | Export as .pdf file |
| `archive-document` | Archive Document | `Archive` | `Ctrl+Shift+A` | Move to archive |
| `delete-document` | Delete Document | `Trash2` | `Ctrl+Shift+D` | Soft delete |
| `duplicate-document` | Duplicate Document | `Copy` | - | Create copy in same project |
| `move-document` | Move to Project... | `FolderInput` | - | Relocate to different project |

**Group Header:** "Document"

### Group 4: Journal Actions

Commands for journal operations. Context-aware: primarily visible on Journal page.

| ID | Text | Icon | Shortcut | Description |
|----|------|------|----------|-------------|
| `journal-next-day` | Next Day | `ChevronRight` | `Ctrl+→` | Navigate forward one day |
| `journal-prev-day` | Previous Day | `ChevronLeft` | `Ctrl+←` | Navigate back one day |
| `journal-promote` | Promote to Document | `FileUp` | `Ctrl+Shift+P` | Convert selected entries to document |
| `journal-delete` | Delete Selected Entries | `Trash2` | `Ctrl+D` | Delete selected journal entries |

**Group Header:** "Journal"

### Group 5: Project Actions

Commands for project management.

| ID | Text | Icon | Shortcut | Description |
|----|------|------|----------|-------------|
| `export-project` | Export Project | `FolderDown` | - | Export all project documents |
| `switch-project` | Switch to... | `ArrowRight` | - | Dynamic: one per other project |
| `switch-last` | Switch to Last Project | `ArrowLeftRight` | `Ctrl+Tab` | Quick switch between two projects |
| `toggle-archived` | Show/Hide Archived | `Archive` | `Ctrl+Shift+H` | Toggle archived documents visibility |

**Group Header:** "Projects"

### Group 6: Git Operations

Commands for version control.

| ID | Text | Icon | Shortcut | Description |
|----|------|------|----------|-------------|
| `git-sync` | Git Sync | `GitCommit` | `Ctrl+Shift+S` | Full sync: fetch, pull, commit, push |
| `git-push` | Git Push | `CloudUpload` | - | Push local commits |
| `git-pull` | Git Pull | `CloudDownload` | - | Pull and merge remote changes |
| `git-status` | Git Status | `GitBranch` | - | View uncommitted changes |

**Group Header:** "Git"

### Group 7: Application

Commands for application-level operations.

| ID | Text | Icon | Shortcut | Description |
|----|------|------|----------|-------------|
| `show-help` | Show Keyboard Shortcuts | `HelpCircle` | `?` or `F1` | Open help modal |
| `toggle-sidebar` | Toggle Sidebar | `PanelLeft` | `Ctrl+B` | Show/hide sidebar |
| `toggle-theme` | Toggle Theme | `Moon` / `Sun` | - | Switch dark/light mode |
| `quit-app` | Quit Application | `LogOut` | `Ctrl+Q` | Close YANTA |

**Group Header:** "Application"

---

## Keyboard Shortcut Badges

Every command that has an associated keyboard shortcut displays that shortcut as a badge to the right of the command text. This is a critical change from the current design which shows descriptive hints.

### Badge Design

```
┌────────────────────────────────────────────────────────────┐
│ Type a command...                                   Esc    │
├────────────────────────────────────────────────────────────┤
│ 📄 New Document                               Ctrl+N       │
│ 🔍 Go to Search                          Ctrl+Shift+F      │
│ 📚 Go to Journal                              Ctrl+J       │
│ 💾 Save Document                              Ctrl+S       │
└────────────────────────────────────────────────────────────┘
```

### Badge Format

- **macOS:** Use symbols: `⌘` (Cmd), `⌥` (Option), `⇧` (Shift), `⌃` (Control)
- **Windows/Linux:** Use text: `Ctrl`, `Alt`, `Shift`
- **Separator:** `+` between modifier and key
- **Typography:** Monospace font, muted color (secondary text)

### Commands Without Shortcuts

Commands without keyboard shortcuts display a brief description instead:

```
│ 📁 Move to Project...                 Relocate document    │
│ ↔️ Switch to @work                          Switch project │
```

---

## Fuzzy Search Behavior

The command palette uses fuzzy matching to quickly find commands. The cmdk library provides basic fuzzy search; this section defines additional search optimizations.

### Search Targets

Each command is searchable by:

1. **Primary text** - The command name (e.g., "New Document")
2. **Keywords** - Additional search terms (aliases)
3. **Shortcut** - The keyboard shortcut itself (e.g., searching "ctrl n" finds New Document)

### Keyword Aliases

Commands should have keyword aliases to match user expectations:

| Command | Keywords |
|---------|----------|
| New Document | create, add, new, document, note |
| Go to Dashboard | home, main, list, documents |
| Go to Journal | diary, daily, notes, log |
| Go to Search | find, search, lookup |
| Git Sync | save, backup, sync, commit, push |
| Export to Markdown | download, export, md |
| Toggle Sidebar | sidebar, panel, navigation, hide, show |

### Command Prioritization

Search results are ordered by:

1. **Exact prefix match** - Commands starting with query appear first
2. **Recency** - Recently used commands appear higher
3. **Frequency** - Frequently used commands appear higher
4. **Static priority** - Navigation commands before actions

### Recency Tracking

The palette should track the last 10 commands executed and boost their position in results. This creates a personalized "recent commands" effect without a separate section.

Implementation approach:
```typescript
interface CommandUsage {
  commandId: string;
  lastUsed: number;      // timestamp
  useCount: number;      // frequency
}

// Stored in localStorage: yanta_command_usage
```

---

## New Commands for Keyboard-First Workflow

The following commands address gaps identified in the [[command-palette-audit]]:

### Recent Documents List

**Command:** `nav-recent` / "Recent Documents"

**Behavior:**
- Opens a sub-palette showing the 10 most recently opened documents
- Each entry shows: document title, project alias, last modified time
- Selecting an entry navigates directly to that document
- Keyboard shortcut: `Ctrl+E` (mnemonic: "recent" or "edit")

**Wireframe:**
```
┌────────────────────────────────────────────────────────────┐
│ Recent Documents                                    Esc    │
├────────────────────────────────────────────────────────────┤
│ 📄 UX Audit Summary           @yanta         2 min ago    │
│ 📄 Meeting Notes             @work          1 hour ago    │
│ 📄 Project Roadmap           @work          yesterday     │
│ 📄 Shopping List             @personal      3 days ago    │
└────────────────────────────────────────────────────────────┘
```

### Quick Switch Between Last Two Views

**Command:** `switch-last` / "Switch to Last Project"

**Behavior:**
- Toggles between current project and previously active project
- Similar to `Ctrl+Tab` in browsers or `Cmd+Tab` in macOS
- Keyboard shortcut: `Ctrl+Tab`
- Maintains a two-item stack: [current, previous]

**Implementation Notes:**
- Store `previousProject` in ProjectContext
- Update on every project switch
- If no previous project, show notification or disable command

### Jump to Today's Journal

**Command:** `nav-today` / "Jump to Today's Journal"

**Behavior:**
- Navigates directly to Journal page with today's date selected
- Keyboard shortcut: `Ctrl+T` (mnemonic: "today")
- If already on Journal page, scrolls to today

### Create Document in Current Project

**Command:** `create-document-here` / "New Document in [Project]"

**Behavior:**
- Creates a new document in the currently selected project
- Command text dynamically shows project name: "New Document in @work"
- Keyboard shortcut: `Ctrl+N` (same as `create-document`)
- Clarifies that new documents are project-scoped

---

## Context-Awareness Behavior

Commands are shown or hidden based on the current context. This prevents clutter and ensures relevance.

### Context Rules

| Context | Commands Shown | Commands Hidden |
|---------|---------------|-----------------|
| **Global (always)** | Navigation, Git, Application | - |
| **Dashboard** | Toggle Archived, Create Document | Document Actions (unless selected) |
| **Document View** | Document Actions, Save | Journal Actions, Toggle Archived |
| **Journal Page** | Journal Actions | Document Actions (unless entry selected) |
| **Projects Page** | Project management | Document Actions, Journal Actions |
| **Settings Page** | Application only | All content-specific commands |
| **Search Results** | Open selected result | Create commands |

### Document Selection Context

Document actions become available when:
1. User is viewing a document (`/document/:id` route)
2. User has selected a document in Dashboard (highlighted row)
3. User has selected a document in Search results

**Implementation:**
```typescript
const hasDocumentContext =
  currentPage === 'document' ||
  selectedDocumentId !== null;
```

### Dynamic Command Text

Some commands change their text based on context:

| Command | Static Text | Dynamic Text (Example) |
|---------|-------------|------------------------|
| Toggle Archived | Show Archived Documents | Hide Archived Documents |
| Switch to Project | Switch to... | Switch to @work |
| Create Document | New Document | New Document in @personal |

---

## Visual Design Specifications

### Palette Container

```css
.command-palette {
  width: 560px;
  max-height: 400px;
  border-radius: 12px;
  background: var(--background-primary);
  border: 1px solid var(--border-color);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.24);
}
```

### Input Field

```css
.command-input {
  height: 48px;
  padding: 0 16px;
  font-size: 15px;
  border-bottom: 1px solid var(--border-color);
}

.command-input::placeholder {
  color: var(--text-muted);
}
```

### Command Item

```css
.command-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 12px;
}

.command-item[aria-selected="true"] {
  background: var(--background-hover);
}

.command-icon {
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
}

.command-text {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
}

.command-shortcut {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  padding: 2px 6px;
  background: var(--background-subtle);
  border-radius: 4px;
}
```

### Group Headers

```css
.command-group-header {
  padding: 8px 16px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}
```

### Empty State

```css
.command-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-muted);
}
```

**Empty state text:** "No commands found. Try a different search."

---

## Accessibility

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate between commands |
| `Enter` | Execute selected command |
| `Escape` | Close palette |
| `Tab` | Move to next group |
| `Shift+Tab` | Move to previous group |

### Screen Reader Support

- Dialog has `role="dialog"` and `aria-label="Command palette"`
- Input has `aria-label="Search commands"`
- Commands have `role="option"` with `aria-selected` state
- Groups have `role="group"` with `aria-label` for group name
- Announce selected command on navigation

### Focus Management

- Focus moves to input on open
- Focus trapped within palette while open
- Focus returns to previous element on close

---

## Implementation Checklist

### Phase 1: Core Improvements
- [ ] Add keyboard shortcut badges to existing commands
- [ ] Add command grouping with headers
- [ ] Add "Show Help" command
- [ ] Add "Toggle Sidebar" command
- [ ] Add keyword aliases for fuzzy search

### Phase 2: New Commands
- [ ] Implement Recent Documents command with sub-palette
- [ ] Implement Jump to Today's Journal
- [ ] Implement Quick Switch (Ctrl+Tab)
- [ ] Implement Save Document command

### Phase 3: Context Awareness
- [ ] Add document selection context tracking
- [ ] Implement context-based command filtering
- [ ] Add dynamic command text for contextual commands

### Phase 4: Search Enhancements
- [ ] Implement recency tracking in localStorage
- [ ] Add frequency-based prioritization
- [ ] Enable searching by keyboard shortcut

---

## Related Documentation

- [[mental-model]] - Core concepts: Documents, Journal, Quick Capture, Projects
- [[quick-access]] - Unified quick access system design
- [[command-palette-audit]] - Current implementation analysis and gaps
- [[discoverability-friction]] - Friction points this design addresses
- [[adr-001-command-palette-first]] - Architecture decision record
