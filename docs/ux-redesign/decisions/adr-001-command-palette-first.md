---
type: decision
title: "ADR-001: Command Palette as Primary Navigation"
created: 2026-02-01
status: proposed
tags:
  - adr
  - ux-redesign
  - command-palette
  - navigation
related:
  - "[[command-palette-design]]"
  - "[[mental-model]]"
  - "[[quick-access]]"
  - "[[adr-002-sidebar-optional]]"
  - "[[adr-003-command-line-fate]]"
---

# ADR-001: Command Palette as Primary Navigation

## Status

**Proposed** - Awaiting user review and approval

## Context

YANTA currently has multiple navigation mechanisms:

1. **Sidebar** - Persistent left-side navigation with links to Dashboard, Projects, Search, Journal, and Settings
2. **Command Palette** (`Ctrl+K`) - A searchable modal for executing commands
3. **Command Line** (`:command`) - A vim-style text input at the bottom of pages
4. **Direct URLs** - Browser address bar navigation

The UX audit (see [[command-palette-audit]]) identified several friction points:

### Discoverability Issues

- Keyboard shortcuts are not consistently displayed
- Users don't know what actions are available without clicking around
- Command line requires typing `:help` to discover commands
- No centralized place to see all available actions

### Inconsistent Mental Models

- Some actions available only via command line (`:archive [paths]`)
- Some actions available only via sidebar (visual project switching)
- Some actions available only via keyboard shortcuts (undiscoverable)
- Users must learn multiple interfaces to become proficient

### Cognitive Load

- Switching between mouse (sidebar) and keyboard (command line) disrupts flow
- Different pages have different available commands
- No unified "what can I do here?" discovery mechanism

### Audit Findings Summary

From [[discoverability-friction]]:
> "The command palette exists but is underutilized. It could serve as the single entry point for all navigation and actions, but currently mirrors only a subset of sidebar functionality."

## Decision

**Make the command palette the primary navigation interface for YANTA.**

### What This Means

1. **Every action is available via palette** - If an action exists, it's in the palette
2. **Keyboard shortcuts appear as badges** - Users learn shortcuts by using the palette
3. **Context-aware commands** - Palette shows relevant commands based on current page
4. **Fuzzy search with aliases** - Multiple ways to find each command
5. **Recency and frequency tracking** - Frequently used commands appear first

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Single Source of Truth** | All actions flow through or are discoverable via palette |
| **Learnable** | Shortcuts shown as badges; users graduate to direct shortcuts |
| **Discoverable** | Search finds commands by name, keyword, or shortcut |
| **Context-Aware** | Only relevant commands shown for current page/selection |
| **Consistent** | Same interface everywhere; no page-specific variations |

### Hierarchy of Access

```
┌─────────────────────────────────────────────────────────────┐
│              Command Palette (Ctrl+K)                       │
│         Primary - Always accessible, searchable             │
├─────────────────────────────────────────────────────────────┤
│              Keyboard Shortcuts                             │
│         Secondary - Power users memorize from palette       │
├─────────────────────────────────────────────────────────────┤
│              Sidebar (Optional)                             │
│         Tertiary - Visual navigation for preference         │
└─────────────────────────────────────────────────────────────┘
```

### New User Journey

1. User opens YANTA for the first time
2. Sees minimal interface (sidebar hidden by default)
3. Presses `Ctrl+K` (or sees hint) to open command palette
4. Searches for action they want ("new document")
5. Sees command with keyboard shortcut badge (`Ctrl+N`)
6. Executes command via palette
7. Next time, user may try `Ctrl+N` directly
8. Eventually graduates to keyboard shortcuts for frequent actions

## Consequences

### Positive

1. **Unified Interface** - One place to discover and execute all actions
2. **Reduced Cognitive Load** - Learn one interface, not three
3. **Natural Shortcut Learning** - Badge exposure teaches shortcuts without memorization
4. **Keyboard-First Efficiency** - Power users stay in keyboard flow
5. **Accessibility** - Screen readers can navigate palette; consistent focus management
6. **Future-Proof** - New features automatically discoverable via palette

### Negative

1. **Mouse Users** - Users who prefer clicking must adapt to palette
2. **Sidebar Removal Friction** - Users accustomed to visual navigation may feel lost
3. **Initial Learning** - New users must learn `Ctrl+K` as first step
4. **Onboarding Requirement** - Need clear first-run guidance to introduce palette

### Neutral

1. **Palette Dependency** - If palette has bugs, many actions become inaccessible
2. **Search Quality** - Fuzzy search must be well-tuned; bad search = frustration
3. **Command Count** - Large number of commands requires good organization

## Mitigations

### For Mouse Users

- Keep sidebar as optional (see [[adr-002-sidebar-optional]])
- Ensure palette is accessible via click (menu icon)
- Allow mouse navigation within palette

### For Initial Learning

- First-run overlay introducing `Ctrl+K`
- Persistent hint in empty states: "Press Ctrl+K to get started"
- Quick Start guide in Help modal

### For Palette Reliability

- Extensive testing of palette component
- Fallback mechanisms if palette fails to open
- Error boundary with recovery instructions

## Alternatives Considered

### Alternative 1: Enhance Sidebar as Primary

**Rejected.** Sidebar navigation requires mouse movement and provides no discovery mechanism for keyboard shortcuts. It also consumes screen space and conflicts with minimal interface goals.

### Alternative 2: Keep Multiple Equals

**Rejected.** Maintaining parity between sidebar, command line, and palette creates maintenance burden and inconsistent user experiences. Users shouldn't need to learn multiple interfaces.

### Alternative 3: Context Menus as Primary

**Rejected.** Right-click menus require mouse precision and are not discoverable without exploration. They also vary by context, increasing cognitive load.

### Alternative 4: Spotlight-Style Search Only

**Considered but modified.** Pure search (like macOS Spotlight) works for launching apps but YANTA needs structured command groups. The palette combines search with organized command sections.

## Implementation Notes

### Phase 1: Core Improvements

- Add keyboard shortcut badges to existing commands
- Add command grouping with headers
- Add keyword aliases for fuzzy search
- See [[command-palette-design]] for full specifications

### Phase 2: New Commands

- Implement Recent Documents command (`Ctrl+E`)
- Implement Jump to Today's Journal (`Ctrl+T`)
- Implement Quick Switch (`Ctrl+Tab`)
- Ensure every sidebar action has palette equivalent

### Phase 3: Context Awareness

- Filter commands based on current page
- Filter commands based on selection state
- Add dynamic command text for contextual commands

### Phase 4: Polish

- Implement recency and frequency tracking
- Enable searching by keyboard shortcut
- Add first-run onboarding overlay

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Palette opens per session | 5+ average | Analytics |
| Sidebar enablement rate | <30% | Settings analytics |
| Support requests for navigation | 50% reduction | Support tickets |
| Keyboard shortcut usage | 40% increase | Usage analytics |

## Related Decisions

- [[adr-002-sidebar-optional]] - Sidebar becomes optional, hidden by default
- [[adr-003-command-line-fate]] - Command line simplified to Quick Create

## References

- [[command-palette-design]] - Full design specifications
- [[command-palette-audit]] - Current implementation analysis
- [[discoverability-friction]] - UX friction points this decision addresses
- [[mental-model]] - Core concepts and access patterns
