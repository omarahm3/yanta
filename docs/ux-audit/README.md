---
type: reference
title: UX Audit Summary
created: 2026-02-01
tags:
  - ux-audit
  - summary
related:
  - "[[navigation-friction]]"
  - "[[discoverability-friction]]"
  - "[[mental-model-friction]]"
  - "[[input-mode-friction]]"
  - "[[user-journeys]]"
  - "[[documents-vs-journal]]"
  - "[[command-palette-audit]]"
  - "[[command-line-audit]]"
---

# UX Audit Summary

This document provides an executive summary of the comprehensive UX audit conducted on YANTA, identifying friction points, documenting navigation mechanisms, and establishing a foundation for a command-palette-first redesign.

---

## Executive Summary

The YANTA UX audit examined **four primary navigation mechanisms** (sidebar, command palette, command line, and keyboard shortcuts), documented **five core user journeys**, and identified **36 friction points** across four categories. The audit reveals a capable but fragmented application where powerful features are hidden from users and multiple overlapping input systems create confusion.

### Key Findings

1. **Discoverability is the primary barrier** - Users cannot easily discover keyboard shortcuts, available commands, or the full capabilities of the application. The command palette shows descriptions instead of shortcuts, and core features like help (`Shift+?`) have no visible entry point.

2. **Three overlapping command systems** - The command palette, command line, and hotkeys each offer partial functionality with different syntax and availability. Users must learn when to use which system, creating decision paralysis.

3. **Mental model confusion** - The Documents vs Journal distinction is unclear to users. Quick Capture saves to Journal, but users expect to find their notes in Documents. The "Dashboard" label obscures document access.

4. **Inconsistent page context** - The command line is absent on Journal, Search, and Settings pages. Hotkey behavior changes by page without indication. This breaks muscle memory and creates unexpected behaviors.

### Audit Scope

- **Documents Reviewed**: 12 audit documents created
- **Friction Points Identified**: 36 total (8 high, 17 medium, 11 low severity)
- **User Journeys Mapped**: 5 core workflows
- **Keyboard Shortcuts Cataloged**: 60+ shortcuts across all contexts

---

## Audit Documents Index

### Navigation Documentation

| Document | Description |
|----------|-------------|
| [[sidebar]] | Sidebar structure, sections, and navigation behavior |
| [[command-palette]] | Command palette commands, component API, and usage |
| [[command-line]] | Command line syntax, available commands per context |
| [[keyboard-shortcuts]] | Complete hotkey catalog organized by page/context |

### User Experience Analysis

| Document | Description |
|----------|-------------|
| [[user-journeys]] | Five core user journeys with ASCII flow diagrams |
| [[documents-vs-journal]] | Analysis of the content type distinction and confusion points |

### Deep Dive Audits

| Document | Description |
|----------|-------------|
| [[command-palette-audit]] | Detailed analysis of palette implementation and gaps |
| [[command-line-audit]] | Detailed analysis of CLI implementation and overlap |

### Friction Point Analysis

| Document | Friction Points | High | Medium | Low |
|----------|-----------------|------|--------|-----|
| [[navigation-friction]] | 8 | 1 | 4 | 3 |
| [[discoverability-friction]] | 10 | 3 | 5 | 2 |
| [[mental-model-friction]] | 9 | 2 | 4 | 3 |
| [[input-mode-friction]] | 9 | 2 | 4 | 3 |
| **Total** | **36** | **8** | **17** | **11** |

---

## Top 5 Friction Points by Severity

These friction points have the highest impact on user experience and should be prioritized in the redesign:

### 1. No Direct Navigation to Specific Document (High)
**ID:** NF-1 | **Category:** Navigation

Users cannot navigate directly to a specific document by name from any page. The command palette offers "New Document" but no "Open Document" or document search within the palette. Users familiar with VS Code's `Ctrl+P` quick-open pattern will expect similar functionality.

**Impact:** Extra navigation steps to reach known documents; breaks keyboard-first workflow.

**Recommendation:** Add fuzzy document search to command palette with "Open Document" command.

---

### 2. Command Palette Hints Show Descriptions, Not Shortcuts (High)
**ID:** DF-1 | **Category:** Discoverability

The command palette displays descriptive hints (e.g., "Create new entry") instead of keyboard shortcuts (e.g., "Ctrl+N"). Users cannot discover shortcuts through normal palette use.

**Impact:** Users never learn keyboard shortcuts; reduces transition to keyboard-first workflow.

**Recommendation:** Replace descriptions with shortcuts in palette hints; fall back to descriptions only when no shortcut exists.

---

### 3. Command Line Placeholder Lies About Help (High)
**ID:** DF-4 | **Category:** Discoverability

The command line placeholder says "type command or press / for help" but pressing `/` does not show help. This is actively misleading and damages trust in UI guidance.

**Impact:** Active user frustration; users give up on learning CLI commands.

**Recommendation:** Either implement `/` help command or fix the placeholder text.

---

### 4. Three Overlapping Command Systems (High)
**ID:** IM-1 | **Category:** Input Modes

YANTA has three distinct systems for issuing commands: command palette (`Ctrl+K`), command line (`:`), and direct keyboard shortcuts. Users must learn when to use which system, creating decision paralysis and incomplete learning of any single system.

**Impact:** Analysis paralysis; muscle memory conflicts; fragmented expertise.

**Recommendation:** Bridge systems by showing CLI equivalents in palette hints; consider long-term unified interface.

---

### 5. Documents vs Journal Distinction Unclear (High)
**ID:** MM-1 | **Category:** Mental Model

Users don't immediately understand the difference between Documents (rich text, persistent) and Journal entries (plain text, date-organized). Both are "notes" in the user's mental model.

**Impact:** Wrong content type choice; time spent in wrong context.

**Recommendation:** Clarify in onboarding; add visual feedback showing Quick Capture destination; rename "Dashboard" to "Documents".

---

## Recommended Focus Areas for Redesign

Based on the audit findings, the redesign should prioritize these areas:

### 1. Unified Command Interface (High Priority)

**Goal:** Consolidate the three command systems into a coherent experience.

- Enhance command palette to be the primary command interface
- Add document search/quick-open functionality (`Ctrl+P` pattern)
- Show keyboard shortcuts in palette hints
- Bridge palette to CLI by showing equivalent commands
- Consider VS Code-style `>` prefix for command mode vs file search mode

### 2. Discoverability Framework (High Priority)

**Goal:** Make features, commands, and shortcuts discoverable through normal use.

- Add `Ctrl+K` badge to application chrome
- Implement contextual shortcut hints in page footer
- Add "Show Help" to command palette
- Fix or remove misleading command line help placeholder
- Improve Quick Capture feedback with "Saved to Journal" notification

### 3. Terminology and Mental Model Alignment (Medium Priority)

**Goal:** Align UI terminology with user expectations and internal concepts.

- Rename "Dashboard" to "Documents" in sidebar
- Clarify Documents vs Journal distinction in onboarding
- Consider "Save as Document" option in Quick Capture
- Unify tag input methods across contexts

### 4. Command Line Improvements (Medium Priority)

**Goal:** Make the command line a viable power-user interface.

- Add autocomplete/tab completion for command names
- Implement command history (Up/Down arrows)
- Add command line to all pages (or clearly indicate unavailability)
- Provide in-context command reference

### 5. Navigation Enhancements (Low Priority)

**Goal:** Reduce friction in common navigation patterns.

- Implement navigation history (`Alt+Left`/`Alt+Right`)
- Add "Go to Today" shortcut in Journal (`t` key)
- Add search result preview pane
- Consider persistent project indicator in header

---

## Complete Keyboard Shortcuts Reference

### Global Shortcuts (Available Everywhere)

| Shortcut | Action | Category |
|----------|--------|----------|
| `Mod+K` | Open command palette | Navigation |
| `Shift+?` | Toggle help modal | System |
| `Ctrl+Q` | Quit (background if enabled) | System |
| `Ctrl+Shift+Q` | Force quit application | System |

### Layout Shortcuts (Pages with Layout Component)

| Shortcut | Action | Category |
|----------|--------|----------|
| `Ctrl+B` | Toggle sidebar | Navigation |
| `Mod+E` | Toggle sidebar | Navigation |
| `:` | Focus command line | Navigation |
| `Escape` | Exit command line | Navigation |

### Dashboard Page

| Shortcut | Action | Category |
|----------|--------|----------|
| `j` / `Arrow Down` | Navigate to next document | Navigation |
| `k` / `Arrow Up` | Navigate to previous document | Navigation |
| `Enter` | Open highlighted document | Navigation |
| `Space` | Select/deselect highlighted document | Editing |
| `Mod+N` | Create new document | Editing |
| `Mod+A` | Archive selected documents | Editing |
| `Mod+U` | Restore archived documents | Editing |
| `Mod+D` | Soft delete selected documents | Editing |
| `Mod+Shift+D` | Permanently delete selected documents | Editing |
| `Mod+Shift+A` | Toggle archived documents view | Navigation |
| `Mod+E` | Export selected to Markdown | System |
| `Mod+Shift+E` | Export selected to PDF | System |

### Document Page

| Shortcut | Action | Category |
|----------|--------|----------|
| `Mod+S` | Save document | Editing |
| `Enter` | Focus editor (when unfocused) | Editing |
| `Mod+C` | Unfocus editor | Editing |
| `Escape` | Navigate back (when editor not focused) | Navigation |
| `Mod+E` | Export to Markdown | System |
| `Mod+Shift+E` | Export to PDF | System |

### Projects Page

| Shortcut | Action | Category |
|----------|--------|----------|
| `j` / `Arrow Down` | Select next project | Navigation |
| `k` / `Arrow Up` | Select previous project | Navigation |
| `Enter` | Switch to selected project | Navigation |
| `Mod+N` | Create new project | Editing |
| `Mod+A` | Archive project | Editing |
| `Mod+U` | Restore archived project | Editing |
| `Mod+R` | Rename project | Editing |
| `Mod+D` | Delete project | Editing |

### Search Page

| Shortcut | Action | Category |
|----------|--------|----------|
| `/` | Focus search input | Navigation |
| `Tab` | Move focus to first result | Navigation |
| `Escape` | Unfocus search input | Navigation |
| `j` | Navigate down results (when not in input) | Navigation |
| `k` | Navigate up results (when not in input) | Navigation |
| `Enter` | Open selected result | Navigation |

### Journal Page

| Shortcut | Action | Category |
|----------|--------|----------|
| `Ctrl+N` / `Arrow Right` | Next day | Navigation |
| `Ctrl+P` / `Arrow Left` | Previous day | Navigation |
| `j` / `Arrow Down` | Highlight next entry | Navigation |
| `k` / `Arrow Up` | Highlight previous entry | Navigation |
| `Space` | Select/deselect highlighted entry | Editing |
| `Mod+D` | Delete selected entries | Editing |
| `Mod+Shift+P` | Promote selected entries to document | Editing |

### Settings Page

| Shortcut | Action | Category |
|----------|--------|----------|
| `j` | Navigate to next section | Navigation |
| `k` | Navigate to previous section | Navigation |

### Quick Capture Window

| Shortcut | Action | Category |
|----------|--------|----------|
| `Ctrl+Enter` | Save and close | Editing |
| `Shift+Enter` | Save and keep window open | Editing |
| `Escape` | Close (press twice to confirm discard) | System |

---

## Shortcut Notation Reference

| Notation | macOS | Windows/Linux |
|----------|-------|---------------|
| `Mod` | `Cmd` | `Ctrl` |
| `Shift+/` | `?` | `?` |
| `Shift+;` | `:` | `:` |

---

## Next Steps

1. **Review audit documents** - Stakeholders should review the detailed friction analysis documents linked above
2. **Prioritize redesign scope** - Determine which recommendations fit within the redesign timeline
3. **Prototype unified command interface** - Create mockups for the enhanced command palette
4. **User testing** - Validate friction points and proposed solutions with actual users
5. **Incremental implementation** - Address high-priority items first (discoverability, palette enhancements)

---

## Related Documentation

- [[navigation-friction]] - Detailed navigation friction analysis
- [[discoverability-friction]] - Feature discovery issues
- [[mental-model-friction]] - Conceptual confusion points
- [[input-mode-friction]] - Input system switching issues
- [[user-journeys]] - Core user journey flows
- [[documents-vs-journal]] - Content type distinction analysis
- [[command-palette-audit]] - Command palette deep dive
- [[command-line-audit]] - Command line deep dive
