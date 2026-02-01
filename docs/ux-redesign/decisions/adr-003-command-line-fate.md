---
type: decision
title: "ADR-003: Command Line Simplification"
created: 2026-02-01
status: proposed
tags:
  - adr
  - ux-redesign
  - command-line
  - navigation
related:
  - "[[quick-access]]"
  - "[[command-palette-design]]"
  - "[[adr-001-command-palette-first]]"
---

# ADR-003: Command Line Simplification

## Status

**Proposed** - Awaiting user review and approval

## Context

YANTA currently has two command interfaces:

1. **Command Palette** (`Ctrl+K`) - A searchable modal for executing commands
2. **Command Line** (`:command`) - A vim-style text input at the bottom of pages

This creates several problems:

### Duplicate Functionality

Nearly all command line functions are duplicated in the command palette:

| Action | Command Palette | Command Line |
|--------|----------------|--------------|
| New Document | "New Document" | `:new [title]` |
| Archive | "Archive Document" | `:archive` |
| Delete | "Delete Document" | `:delete` |
| Export | "Export to Markdown" | `:export-md` |
| Git Sync | "Git Sync" | `:sync` |
| Tag | "Tag Document" | `:tag [tags]` |

### Learning Curve

Users must learn two command syntaxes:
- Palette: Natural language, searchable, discoverable
- Command line: Colon-prefix syntax, vim-like, memorization required

### Discoverability Gap

Command palette commands are visible and searchable. Command line commands require typing `:help` to discover, violating the [[command-palette-design]] principle that all actions should be discoverable via the palette.

### Context Confusion

Different pages have different command sets:
- Dashboard: Document commands
- Projects: Project commands
- Document view: Tag and export commands

This context-switching increases cognitive load.

### Visual Inconsistency

The command line occupies screen space on some pages (Dashboard, Document) but not others (Journal, Settings), creating inconsistent layouts.

## Decision

**Transform the command line from a command interface into a Quick Create Input.**

### What This Means

**Remove:**
- All `:command` syntax parsing
- Navigation commands (`:doc`, `:switch`)
- Action commands (`:archive`, `:delete`, `:export-*`)
- Help command (`:help`)

**Keep:**
- Text input field at bottom of page
- Project context indicator (`@work >`)
- Submit on Enter

**Add:**
- Plain text input creates new document with that title
- `Shift+Enter` creates journal entry with that content
- Hint badges showing `Enter: doc` and `Shift+Enter: journal`

### New Behavior

**Before:**
```
@work > :new Meeting Notes for Q1 Planning
```

**After:**
```
@work > Meeting Notes for Q1 Planning
        [Enter: doc]  [Shift+Enter: journal]
```

The input becomes a "quick create" mechanism rather than a command interface.

### Command Migration

All removed commands migrate to the command palette:

| Old Command | New Access |
|-------------|------------|
| `:new [title]` | Quick Create input (plain text + Enter) |
| `:doc [path]` | Palette: "Recent Documents" or search |
| `:archive` | Palette: "Archive Document" |
| `:delete` | Palette: "Delete Document" |
| `:tag [tags]` | Palette: "Tag Document" |
| `:export-md` | Palette: "Export to Markdown" |
| `:sync` | Palette: "Git Sync" |
| `:switch @alias` | Palette: "Switch to @alias" |

## Consequences

### Positive

1. **Single Source of Truth** - All commands flow through the command palette
2. **Reduced Learning Curve** - Users learn one interface, not two
3. **Better Discoverability** - All actions visible in searchable palette
4. **Consistent Layout** - Quick Create input is simpler and consistent
5. **Keyboard-First Alignment** - Reinforces `Ctrl+K` as the universal entry point

### Negative

1. **Power User Adjustment** - Users comfortable with `:command` syntax must adapt
2. **Bulk Operations** - Path-based bulk commands (`:delete [paths]`) require palette equivalent
3. **Migration Friction** - Existing muscle memory will need retraining

### Neutral

1. **Vim-Style Appeal** - Some users prefer colon-prefix syntax; others find it cryptic
2. **Screen Space** - Quick Create input uses same space as command line

## Migration Plan

### Phase 1: Deprecation Warning (Soft)
- `:command` still works
- Show toast: "Tip: Use Ctrl+K for commands. Command line is becoming Quick Create."
- Duration: 2 weeks

### Phase 2: Gentle Nudge (Medium)
- `:command` still works
- Show inline hint: "Did you mean Ctrl+K → [Command Name]?"
- Link to help documentation
- Duration: 2 weeks

### Phase 3: Full Transition (Hard)
- Remove `:command` parsing
- Plain text only
- Add hint badges for Enter/Shift+Enter
- Rename component to `QuickCreateInput`

### Rollback Plan

If user feedback is strongly negative:
- Re-enable `:command` parsing
- Keep Quick Create as additional mode
- Document both approaches in help

## Alternatives Considered

### Alternative 1: Keep Both Systems

**Rejected.** Maintaining two command interfaces violates the command-palette-first principle and creates ongoing maintenance burden.

### Alternative 2: Remove Command Line Entirely

**Rejected.** The quick create pattern (type → Enter → new item) is valuable and faster than opening the palette for simple creation.

### Alternative 3: Merge Into Palette

**Rejected.** The always-visible input field provides immediate affordance for creation. Palette requires `Ctrl+K` first, adding friction.

### Alternative 4: Make Command Line Optional

**Considered but deferred.** Could add a setting to enable "legacy command mode." Adds complexity; revisit based on feedback.

## Implementation Notes

### Backend Changes

- `internal/commandline/` package remains for any server-side command parsing
- Remove frontend-triggered command parsing
- Keep command validation for API endpoints

### Frontend Changes

- Replace `CommandLine` component with `QuickCreateInput`
- Remove `useGlobalCommand` hook's `:command` handling
- Add `Shift+Enter` handler for journal entry creation
- Update placeholder text and hint badges

### Testing

- Ensure all migrated commands work via palette
- Test Quick Create for document and journal entry
- Verify deprecation warnings display correctly
- Test migration phases independently

## Related Decisions

- [[adr-001-command-palette-first]] - Establishes palette as primary navigation
- [[adr-002-sidebar-optional]] - Establishes sidebar as optional visual aid
- [[quick-access]] - Full design specification for unified navigation

## References

- [[command-palette-design]] - Command palette specifications
- [[mental-model]] - Core concepts and access patterns
- [[discoverability/shortcuts]] - Keyboard shortcut visibility strategy
