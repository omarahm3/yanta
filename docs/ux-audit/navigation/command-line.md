---
type: research
title: Command Line Documentation
created: 2026-02-01
tags:
  - ux-audit
  - navigation
related:
  - "[[sidebar]]"
  - "[[command-palette]]"
  - "[[keyboard-shortcuts]]"
---

# Command Line

This document details the command line syntax, available commands, and parsing behavior.

## Component Architecture

### Core Files

| File | Purpose |
|------|---------|
| `frontend/src/components/ui/commandline/CommandLine.tsx` | Main UI component |
| `frontend/src/components/ui/commandline/types.ts` | Type definitions |
| `frontend/src/components/Layout.tsx` | Integration point |
| `frontend/src/utils/commandPreprocessor.ts` | Command expansion |
| `frontend/src/components/ui/HelpModal.tsx` | Help documentation |

### Component Props

```typescript
interface CommandLineProps {
  context: string;        // Prompt prefix (e.g., project alias)
  placeholder?: string;   // Input placeholder text
  value: string;          // Controlled input value
  onChange: (value: string) => void;
  onSubmit: (command: string) => void;
}
```

## Visual Design

- **Prompt Format**: `${context} >` (e.g., `proj >`)
- **Font**: Monospace
- **Location**: Bottom of the Layout component
- **Submission**: Enter key

## Keyboard Access

| Shortcut | Action |
|----------|--------|
| `Shift+;` (`:`) | Focus command line |
| `Escape` | Exit/blur command line |

## Command Syntax

Commands follow a simple pattern:
```
[:]command [arguments] [--flags]
```

- Optional `:` prefix is automatically stripped
- Arguments are space-separated
- Flags follow `--flag` convention

## Global Commands

Available from any page:

| Command | Description | Example |
|---------|-------------|---------|
| `switch @alias` | Switch to project by alias | `switch @work` |
| `sync` | Sync changes to Git | `sync` |
| `quit` | Quit application | `quit` |

## Document Commands (Dashboard Context)

### Creating Documents

| Command | Description |
|---------|-------------|
| `new [text]` | Create new document with optional initial text |

### Opening Documents

| Command | Description |
|---------|-------------|
| `doc <index>` | Open document by number (e.g., `doc 3`) |
| `doc <path>` | Open document by file path |

### Archiving

| Command | Description |
|---------|-------------|
| `archive <index>` | Archive document by number |
| `archive <path>` | Archive document by path |
| `archive <idx1>,<idx2>,...` | Archive multiple documents |
| `unarchive <index>` | Restore document by number |
| `unarchive <path>` | Restore document by path |

### Deleting

| Command | Description |
|---------|-------------|
| `delete <index>` | Soft delete (can be restored) |
| `delete <path>` | Soft delete by path |
| `delete <idx1>,<idx2>,...` | Delete multiple documents |
| `delete <index> --force --hard` | **Permanent** deletion |

**Warning:** `--force --hard` cannot be undone.

### Exporting

| Command | Description |
|---------|-------------|
| `export-md <index>` | Export document to Markdown |
| `export-pdf <index>` | Export document to PDF |

## Project Commands (Projects Page)

### Creating Projects

```
new [name] [alias] [start-date] [end-date]
```
- Name: no spaces allowed
- Dates: `DD-MM-YYYY` or `YYYY-MM-DD` format

### Managing Projects

| Command | Description |
|---------|-------------|
| `archive [alias]` | Archive a project |
| `unarchive [alias]` | Restore archived project |
| `rename [alias] [new-name]` | Rename a project |
| `delete [alias]` | Delete (warns if has entries) |
| `delete [alias] --force` | Soft delete with entries |
| `delete [alias] --force --hard` | **Permanent** deletion |

**Warning:** `--force --hard` removes ALL files from vault permanently.

## Command Preprocessing

The preprocessor (`commandPreprocessor.ts`) handles expansion before parsing:

### Numeric Shortcuts

Converts document indices to full paths:

```
archive 2 --hard
→ archive projects/proj/doc-2.json --hard

delete 1,3,5 --force --hard
→ delete projects/proj/doc-1.json,projects/proj/doc-3.json,projects/proj/doc-5.json --force --hard
```

**Commands supporting numeric shortcuts:**
- `doc`
- `archive`
- `unarchive`
- `delete`
- `export-md`
- `export-pdf`

### Selected Document Expansion

When documents are selected and command has no arguments:

```
archive --hard
→ archive doc1.json,doc2.json --hard (from selection)
```

**Commands supporting selection expansion:**
- `archive`
- `unarchive`
- `delete`

## Execution Pipeline

```
1. User types command + Enter
        ↓
2. CommandLine.onSubmit(value.trim())
        ↓
3. Layout checks global commands (switch, sync, quit)
        ↓
   [If global] → GlobalCommands.Parse() → Stop
        ↓
4. Context-specific handler activated
        ↓
5. preprocessCommand() expands shortcuts
        ↓
6. Backend ParseWithContext() parses command
        ↓
7. Result: { success, message, data, requiresConfirmation }
        ↓
8. [If confirmation needed] → Show dialog
        ↓
9. Execute action based on message type
        ↓
10. Show notification, clear input
```

## Confirmation Dialogs

Dangerous operations require user confirmation:

| Action | Dialog Type |
|--------|-------------|
| `archive` | Simple confirm |
| `delete` (soft) | Simple confirm |
| `delete --hard --force` | Warning + checkbox + input confirmation |

## Context-Aware Behavior

### Dashboard Context
- **Placeholder**: "what did you ship today?"
- **Prompt**: Project alias (e.g., `proj >`)
- **Available**: Document commands + global commands

### Projects Context
- **Prompt**: `YANTA >`
- **Available**: Project commands + global commands

### Document/Editor Context
- **Available**: Global commands + navigation

## Help System

Access the help modal with `Shift+/` or `?`:

### Sections Displayed
1. **GLOBAL COMMANDS**: Available everywhere
2. **{PAGE} COMMANDS**: Context-specific commands
3. **KEYBOARD SHORTCUTS**: Categorized by feature

### Features
- Searchable with live filtering
- Toggle with `?` key
- Close with `Escape` (or clear search first)

## Backend Integration

Commands are parsed and executed via backend bindings (generated from Go):

| Function | Purpose |
|----------|---------|
| `ParseWithContext(cmd, alias)` | Parse document commands |
| `Parse(cmd)` | Parse project/global commands |

**Return Structure:**
```typescript
{
  success: boolean;
  message: string;
  data: any;
  requiresConfirmation: boolean;
  confirmationCommand: string;
}
```

## Result Handling

Actions triggered based on `message` field:

| Message | Action |
|---------|--------|
| "navigate to document" | Open document editor |
| "document archived" | Reload document list |
| "document deleted" | Reload document list |
| "export document" | Open save dialog, export markdown |
| "export to PDF" | Open save dialog, export PDF |
