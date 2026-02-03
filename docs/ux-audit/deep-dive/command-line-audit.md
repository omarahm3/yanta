---
type: analysis
title: Command Line Audit
created: 2026-02-01
tags:
  - ux-audit
  - command-line
related:
  - "[[command-palette]]"
  - "[[command-line]]"
  - "[[keyboard-shortcuts]]"
  - "[[navigation-friction]]"
  - "[[input-mode-friction]]"
---

# Command Line Audit

This document provides a deep-dive analysis of the command line implementation, documenting command syntax, available commands per context, overlap with the command palette, and assessment of whether it serves a distinct purpose.

## Source Files Reviewed

| File | Purpose | LOC |
|------|---------|-----|
| `frontend/src/components/ui/commandline/CommandLine.tsx` | UI component wrapper | ~46 |
| `frontend/src/components/ui/commandline/types.ts` | TypeScript interfaces | ~8 |
| `frontend/src/components/Layout.tsx` | Command line integration | ~187 |
| `frontend/src/pages/dashboard/useDashboardController.ts` | Dashboard command handling | ~724 |
| `frontend/src/pages/dashboard/useDashboardCommandHandler.ts` | Dashboard command parsing | ~239 |
| `frontend/src/pages/document/useDocumentController.ts` | Document command handling | ~461 |
| `frontend/src/pages/Projects.tsx` | Projects command handling | ~570 |
| `frontend/src/utils/commandPreprocessor.ts` | Numeric index-to-path conversion | ~89 |
| `frontend/src/hooks/useGlobalCommand.ts` | Global command interception | ~72 |
| `frontend/bindings/yanta/internal/commandline/models.ts` | Backend command models | ~255 |

## Component Architecture

### CommandLine Component

The command line is a simple input component that displays a context prompt and handles Enter key submission.

```typescript
interface CommandLineProps {
  context: string;          // Displayed as "{context} >" prompt
  placeholder?: string;     // Default: "type command or press / for help"
  value: string;            // Controlled input value
  onChange: (value: string) => void;
  onSubmit: (command: string) => void;
}
```

**Visual Structure:**
```
┌────────────────────────────────────────────────────────────────┐
│ {context} >  │ {value or placeholder}                          │
└──────────────┴─────────────────────────────────────────────────┘
   Prompt area       Input area (styled as ghost input)
```

**Key Behaviors:**
- Enter key triggers `onSubmit` with trimmed value
- No built-in command parsing (delegated to parent)
- No history or autocomplete functionality
- Escape handling is managed by `Layout.tsx`

### Layout Integration

The `Layout` component conditionally renders the command line and manages:
- Focus hotkey (`Shift+;` or `:`)
- Escape handling (blur and clear input)
- Global command interception (switch, sync, quit)
- Delegation to page-specific handlers

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layout                                                             │
├─────────────────────────────────────────────────────────────────────┤
│  1. User enters command                                             │
│  2. Layout.handleCommandSubmit()                                    │
│     ├─ executeGlobalCommand() → if handled, show notification       │
│     └─ else → onCommandSubmit() (page-specific handler)             │
└─────────────────────────────────────────────────────────────────────┘
```

### Command Flow Diagram

```
User Input
    │
    ▼
┌───────────────────┐
│   Layout.tsx      │
│   handleSubmit    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────────────┐
│   useGlobalCommand.ts     │
│   executeGlobalCommand()  │
│   Commands: switch, sync, │
│             quit          │
└─────────┬─────────────────┘
          │
          ├─── handled ───▶ Show notification, clear input
          │
          ▼ (not handled)
┌───────────────────────────┐
│   Page-Specific Handler   │
│   (Dashboard, Projects,   │
│    Document)              │
└─────────┬─────────────────┘
          │
          ▼
┌───────────────────────────┐
│   Backend Parser          │
│   ParseWithContext() or   │
│   ParseWithDocument() or  │
│   Parse() (Projects)      │
└─────────┬─────────────────┘
          │
          ▼
┌───────────────────────────┐
│   Result Handling         │
│   - Navigate              │
│   - Show confirmation     │
│   - Reload data           │
│   - Show notification     │
└───────────────────────────┘
```

## Command Syntax and Available Commands

### Prefix Handling

Commands can optionally start with `:` (vim-style). Both formats are equivalent:
- `:new My Document`
- `new My Document`

The prefix is stripped before parsing in all handlers.

### Global Commands (All Pages)

Handled by `useGlobalCommand.ts`, intercepted before page-specific parsing.

| Command | Syntax | Description | Backend Call |
|---------|--------|-------------|--------------|
| `switch` | `switch <alias>` | Switch to a different project | `GlobalCommands.Parse()` |
| `sync` | `sync` | Trigger git sync | `GlobalCommands.Parse()` |
| `quit` | `quit` | Quit the application | `GlobalCommands.Parse()` |

### Dashboard Commands

Context: Project alias (e.g., `@yanta >`)
Placeholder: "what did you ship today?"

| Command | Syntax | Description | Flags |
|---------|--------|-------------|-------|
| `new` | `new [text]` | Create new document with optional title | - |
| `doc` | `doc <index>` | Open document by list number | - |
| `archive` | `archive <index>` | Archive document | - |
| `unarchive` | `unarchive <index>` | Restore archived document | - |
| `delete` | `delete <index>` | Soft delete document | `--force`, `--hard` |
| `export-md` | `export-md <index>` | Export document to Markdown | - |
| `export-pdf` | `export-pdf <index>` | Export document to PDF | - |

**Index Preprocessing:**

The `commandPreprocessor.ts` utility converts numeric indices to document paths:
- `doc 3` → `doc /vault/@project/doc-uuid.json`
- `delete 1,3,5` → `delete /path1.json,/path3.json,/path5.json`

**Selection-Aware Commands:**

When documents are selected (via Space key), commands operate on selection:
- `archive` (no index) → archives all selected documents
- `delete` (no index) → deletes all selected documents

### Projects Page Commands

Context: `project >`
Placeholder: "type command or press / for help"

| Command | Syntax | Description | Flags |
|---------|--------|-------------|-------|
| `new` | `new <name> <alias> [start-date] [end-date]` | Create new project | - |
| `archive` | `archive <alias>` | Archive a project | - |
| `unarchive` | `unarchive <alias>` | Restore archived project | - |
| `rename` | `rename <alias> <new-name>` | Rename a project | - |
| `delete` | `delete <alias>` | Delete project (warns if has entries) | `--force`, `--hard` |

**Alias Format:** Must start with `@` (e.g., `@yanta`)

**Date Format:** `DD-MM-YYYY` or `YYYY-MM-DD`

### Document Page Commands

Context: `document >`
Placeholder: ":tag web frontend | :untag react | :tags"

| Command | Syntax | Description |
|---------|--------|-------------|
| `tag` | `tag <tag1> [tag2] [tag3...]` | Add tags (space or comma-separated) |
| `untag` | `untag <tag>` or `untag *` | Remove specific tag or all tags |
| `tags` | `tags` | List all tags on document |
| `export-md` | `export-md` | Export current document to Markdown |
| `export-pdf` | `export-pdf` | Export current document to PDF |
| `unarchive` | `unarchive` | Restore archived document |

### Journal Page

**Note:** The Journal page does NOT have a command line. `showCommandLine={false}` in Journal.tsx.

Journal operations are performed via:
- Hotkeys (j/k navigation, Space selection, Ctrl+D delete)
- Status bar buttons (Clear, Promote to Doc, Delete)
- Quick Capture from anywhere

### Search Page

**Note:** The Search page does NOT have a command line. `showCommandLine={false}` in Search.tsx.

Search uses its own input field for query syntax:
- `project:alias` - Filter by project
- `tag:name` - Filter by tag
- `title:text` - Search in titles
- `body:text` - Search in body
- `-exclude` - Exclude term
- `"phrase"` - Exact phrase match
- `AND`, `OR` - Boolean operators

### Settings Page

**Note:** The Settings page does NOT have a command line. `showCommandLine={false}` in Settings.tsx.

## Backend Command Models

### DocumentCommand Enum

```typescript
enum DocumentCommand {
  DocumentCommandNew = "new",
  DocumentCommandDoc = "doc",
  DocumentCommandArchive = "archive",
  DocumentCommandUnarchive = "unarchive",
  DocumentCommandDelete = "delete",
  DocumentCommandTag = "tag",
  DocumentCommandUntag = "untag",
  DocumentCommandTags = "tags",
  DocumentCommandExportMD = "export-md",
  DocumentCommandExportPDF = "export-pdf",
}
```

### ProjectCommand Enum

```typescript
enum ProjectCommand {
  ProjectCommandNew = "new",
  ProjectCommandArchive = "archive",
  ProjectCommandUnarchive = "unarchive",
  ProjectCommandRename = "rename",
  ProjectCommandDelete = "delete",
}
```

### GlobalCommand Enum

```typescript
enum GlobalCommand {
  GlobalCommandSwitch = "switch",
  GlobalCommandSync = "sync",
  GlobalCommandQuit = "quit",
}
```

### Result Structure

All commands return a result object with:
```typescript
interface Result {
  success: boolean;
  message: string;           // Used for action routing and notifications
  data?: {
    documentPath?: string;
    title?: string;
    flags?: string[];
    requiresConfirmation?: boolean;
    confirmationCommand?: string;
  };
  context: CommandContext;   // project, entry, tag, search, system, global
}
```

## Overlap with Command Palette

### Feature Comparison Matrix

| Capability | Command Line | Command Palette |
|------------|--------------|-----------------|
| **Input Style** | Vim-like text commands | Searchable menu |
| **Activation** | `:` or `Shift+;` | `Ctrl+K` |
| **Context Awareness** | Full (project, document, selection) | Limited (page only) |
| **Fuzzy Search** | ❌ No | ✅ Yes |
| **Command History** | ❌ No | ❌ No |
| **Autocomplete** | ❌ No | ✅ Yes (via search) |
| **Batch Operations** | ✅ Yes (via selection) | ❌ No |
| **Index Shortcuts** | ✅ Yes (`doc 3`) | ❌ No |
| **Flags Support** | ✅ Yes (`--force --hard`) | ❌ No |
| **Navigation** | Limited (via `switch`) | ✅ Full |
| **Git Operations** | ✅ Yes (via `sync`) | ✅ Yes |
| **Document Operations** | ✅ Full (context-aware) | Limited (global only) |

### Functional Overlap

| Function | Command Line | Command Palette | Notes |
|----------|--------------|-----------------|-------|
| Create new document | `new [title]` | "New Document" | CLI can set initial title |
| Navigate to document | `doc <index>` | ❌ No | CLI uses index, palette has no equivalent |
| Export to Markdown | `export-md [index]` | "Export Document" | Both require active document |
| Export to PDF | `export-pdf [index]` | "Export Document to PDF" | Both require active document |
| Git sync | `sync` | "Git Sync" | Equivalent |
| Switch project | `switch <alias>` | "Switch to {alias}" | CLI uses alias, palette shows list |
| Archive document | `archive <index>` | ❌ Missing | CLI only |
| Delete document | `delete <index>` | ❌ Missing | CLI only |
| Tag management | `tag`, `untag`, `tags` | ❌ Missing | CLI only |
| Project management | `new`, `rename`, `delete` | ❌ Missing | CLI only |
| Quit application | `quit` | ❌ Missing | CLI only |

### Distinct Purposes

#### Command Line Strengths

1. **Batch Operations:** Can operate on multiple items via selection or comma-separated indices
2. **Precision:** Direct index access (`doc 3`) is faster than searching
3. **Power User Workflow:** Muscle memory for common operations
4. **Context-Specific Commands:** Tag management, project creation with dates
5. **Flags:** Fine-grained control (`--force --hard` for permanent deletion)

#### Command Palette Strengths

1. **Discoverability:** Visual menu shows all available options
2. **Fuzzy Search:** Type partial match to find commands
3. **Navigation:** Full page navigation in one place
4. **Git Status Feedback:** Shows sync status in UI
5. **Accessibility:** No need to remember command syntax

### Assessment: Does Command Line Create Confusion?

**Verdict: Partial Overlap, But Distinct Purposes**

The command line and command palette serve different user profiles:

| User Type | Preferred Interface | Reason |
|-----------|---------------------|--------|
| Power User | Command Line | Speed, batch ops, vim-style workflow |
| Casual User | Command Palette | Discoverability, visual feedback |
| New User | Command Palette | Learning curve is lower |
| Expert | Both | Use CLI for data ops, palette for navigation |

**Points of Confusion:**

1. **Duplicate Git Sync:** Both `sync` command and "Git Sync" menu item exist
2. **Export Ambiguity:** CLI uses `export-md`/`export-pdf`, palette uses different wording
3. **No Cross-Linking:** Neither interface hints at the other's existence
4. **Inconsistent Availability:** CLI on Dashboard/Projects/Document, not on Journal/Search/Settings

## Friction Points Identified

### 1. No Autocomplete or Tab Completion

Users must remember exact command syntax. No hints while typing.

**Severity:** Medium

### 2. No Command History

Up/Down arrows do not recall previous commands. Users must retype.

**Severity:** Medium

### 3. Inconsistent Presence

Command line appears on some pages but not others, creating muscle memory confusion.

| Page | Command Line | Reason |
|------|--------------|--------|
| Dashboard | ✅ Yes | Document operations |
| Projects | ✅ Yes | Project operations |
| Document | ✅ Yes | Tag operations |
| Journal | ❌ No | Uses status bar buttons |
| Search | ❌ No | Has search input instead |
| Settings | ❌ No | Navigation-only page |

**Severity:** Low (intentional design choice)

### 4. Error Messages Not Always Helpful

Backend error messages are passed through directly without user-friendly formatting.

**Severity:** Low

### 5. No Help Integration

Typing `/` or `?` in command line does not show help. Must use `Shift+?` for help modal.

**Severity:** Medium (placeholder says "press / for help" but it doesn't work)

### 6. Confirmation Flow Breaks Keyboard Workflow

Hard delete requires checkbox confirmation with mouse interaction.

**Severity:** Low (safety feature)

## Recommendations

### Immediate Improvements

1. **Fix Help Shortcut:** Make `/` in command line actually open help
2. **Add Command History:** Store and recall recent commands with Up/Down
3. **Show Context-Specific Hints:** Display available commands in empty input placeholder

### Medium-Term Improvements

1. **Tab Completion:** Autocomplete command names and document indices
2. **Unified Command Reference:** Link CLI commands to palette commands in help modal
3. **Command Line on Journal:** Add basic commands for entry management

### Long-Term Considerations

1. **CLI-Palette Integration:** Let users switch between modes (press Tab in CLI to open palette)
2. **Custom Aliases:** Let users define shorthand commands
3. **Command Recording:** Macro support for repeated operations

## Summary Statistics

| Metric | Value |
|--------|-------|
| Pages with command line | 3 (Dashboard, Projects, Document) |
| Pages without command line | 3 (Journal, Search, Settings) |
| Global commands | 3 (switch, sync, quit) |
| Dashboard commands | 7 |
| Projects commands | 5 |
| Document commands | 6 |
| Total unique commands | ~18 |
| Commands overlapping with palette | 4 (new, export-md, export-pdf, sync) |
| Commands unique to CLI | 14+ |
| Commands unique to palette | 5+ (navigation, toggle archived) |

## Conclusion

The command line serves a distinct purpose as a power-user interface optimized for batch operations and precise document/project management. It complements rather than duplicates the command palette. However, inconsistent availability and lack of discoverability features (autocomplete, history, help integration) create friction for users trying to adopt a keyboard-first workflow.

**Key Insight:** The placeholder "press / for help" is misleading—this functionality does not exist. This is the most actionable friction point to address.
