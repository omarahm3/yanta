---
type: reference
title: UX Redesign Summary
created: 2026-02-01
tags:
  - ux-redesign
  - summary
  - roadmap
related:
  - "[[mental-model]]"
  - "[[command-palette-design]]"
  - "[[sidebar-toggle]]"
  - "[[differentiation]]"
  - "[[shortcuts]]"
  - "[[quick-access]]"
  - "[[adr-001-command-palette-first]]"
  - "[[adr-002-sidebar-optional]]"
  - "[[adr-003-command-line-fate]]"
---

# UX Redesign: Command-Palette-First Architecture

This document summarizes the information architecture redesign for YANTA, transitioning from a sidebar-centric to a **command-palette-first** navigation paradigm. It provides an overview of all proposed changes, links to detailed design documents, and a prioritized implementation roadmap.

---

## Executive Summary

The redesign addresses friction points identified in the UX audit by establishing a clear hierarchy of navigation mechanisms:

1. **Command Palette** (`Ctrl+K`) - Primary interface for all navigation and actions
2. **Keyboard Shortcuts** - Direct access for power users who learn from palette badges
3. **Sidebar** - Optional visual navigation for users who prefer it (off by default)

This approach reduces cognitive load, improves discoverability, and aligns YANTA with modern keyboard-first applications like VS Code, Linear, and Raycast.

---

## New Mental Model

The redesign establishes four core concepts with clear boundaries:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           PROJECTS                                  │
│                    (Organizational Container)                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                        @personal                             │   │
│   │   ┌───────────────────────┐   ┌───────────────────────────┐ │   │
│   │   │      DOCUMENTS        │   │        JOURNAL            │ │   │
│   │   │   (Knowledge Base)    │   │    (Daily Stream)         │ │   │
│   │   │   - Rich text         │   │   - Plain text            │ │   │
│   │   │   - Structured        │   │   - Time-indexed          │ │   │
│   │   │   - Long-form         │   │   - Quick notes           │ │   │
│   │   └───────────────────────┘   └───────────────────────────┘ │   │
│   │                                         ▲                   │   │
│   │                                         │ saves to          │   │
│   │                                 ┌───────┴───────┐           │   │
│   │                                 │ QUICK CAPTURE │           │   │
│   │                                 │ (Fast Entry)  │           │   │
│   │                                 └───────────────┘           │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Concept Definitions

| Concept | Definition | Primary Access |
|---------|------------|----------------|
| **Documents** | Long-form, rich text notes for project documentation and knowledge base | `Ctrl+K` → "New Document" |
| **Journal** | Time-indexed quick notes organized by date; captures daily thoughts | `Ctrl+K` → "Go to Journal" |
| **Quick Capture** | System-wide floating overlay for zero-friction note capture | Global hotkey |
| **Projects** | Organizational containers that scope documents and journal entries | `Ctrl+K` → "Switch Project" |

**Full specification:** [[mental-model]]

---

## Design Documents Index

### Core Architecture

| Document | Purpose | Link |
|----------|---------|------|
| **Mental Model** | Defines Documents, Journal, Quick Capture, Projects with relationships | [[mental-model]] |
| **Command Palette Design** | Primary navigation interface with 7 command groups, fuzzy search, context-awareness | [[navigation/command-palette-design]] |
| **Quick Access System** | Unified navigation hierarchy; Recent Documents; command line simplification | [[navigation/quick-access]] |

### Settings & Layout

| Document | Purpose | Link |
|----------|---------|------|
| **Sidebar Toggle** | Sidebar-off-by-default settings; persistence; transition animations | [[settings/sidebar-toggle]] |

### Visual Design

| Document | Purpose | Link |
|----------|---------|------|
| **Visual Differentiation** | Documents vs Journal styling; icons; colors; layout differences | [[visual/differentiation]] |
| **Keyboard Shortcut Discoverability** | Hint badges; footer bar; Help modal reorganization; learn-as-you-go tooltips | [[discoverability/shortcuts]] |

### Architecture Decision Records

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-001** | Command Palette as Primary Navigation | Proposed | [[decisions/adr-001-command-palette-first]] |
| **ADR-002** | Sidebar Off by Default | Proposed | [[decisions/adr-002-sidebar-optional]] |
| **ADR-003** | Command Line → Quick Create Input | Proposed | [[decisions/adr-003-command-line-fate]] |

---

## Proposed Changes Summary

### Navigation Changes

| Change | Description | Priority |
|--------|-------------|----------|
| Command palette as primary | All actions discoverable and executable via `Ctrl+K` | P0 |
| Keyboard shortcut badges | Show shortcuts next to commands in palette | P0 |
| Recent Documents (`Ctrl+E`) | Quick access to last 10 opened documents | P0 |
| Jump to Today (`Ctrl+T`) | Direct navigation to today's journal | P0 |
| Quick Switch (`Ctrl+Tab`) | Toggle between last two projects | P1 |
| Context-aware filtering | Show only relevant commands for current page | P1 |

### Settings Changes

| Change | Description | Priority |
|--------|-------------|----------|
| Sidebar default off | New `sidebar_visible` setting, default `false` | P0 |
| Sidebar persistence | Toggle state survives refresh/restart | P0 |
| Settings UI toggle | "Show Sidebar" in Appearance section | P1 |

### Visual Changes

| Change | Description | Priority |
|--------|-------------|----------|
| Mode header icons | `FileText` for Documents, `BookOpen` for Journal | P1 |
| Mode accent colors | Blue for Documents, Purple for Journal | P1 |
| Context bar/breadcrumb | Persistent location indicator with `Ctrl+K` hint | P1 |
| Footer hint bar | Context-aware keyboard shortcuts at bottom | P1 |

### Command Line Changes

| Change | Description | Priority |
|--------|-------------|----------|
| Remove `:command` syntax | Deprecate vim-style commands | P1 |
| Quick Create Input | Plain text + Enter = document; Shift+Enter = journal | P1 |
| Migration warnings | Gentle nudge during transition period | P1 |

### Discoverability Changes

| Change | Description | Priority |
|--------|-------------|----------|
| Help modal reorganization | Collapsible sections by context | P1 |
| Learn-as-you-go tooltips | Fade after 5 views, reset after 30 days | P2 |
| First-run onboarding | Introduce `Ctrl+K` and `?` prominently | P2 |
| Progressive milestones | Surface new shortcuts at usage thresholds | P2 |

---

## Priority Definitions

| Priority | Definition | Criteria |
|----------|------------|----------|
| **P0** (Must Have) | Essential for command-palette-first paradigm | Required for MVP |
| **P1** (Should Have) | Significantly improves UX and discoverability | Included if time permits |
| **P2** (Nice to Have) | Polish and progressive disclosure features | Future enhancement |

---

## Implementation Roadmap

### Phase 1: Foundation (P0)

Establish command-palette-first navigation as the primary interface.

#### 1.1 Command Palette Core

- [ ] Add keyboard shortcut badges to existing commands
- [ ] Add command grouping with headers (Navigation, Create, Document, Journal, Project, Git, Application)
- [ ] Add keyword aliases for fuzzy search
- [ ] Implement platform-specific key symbols (⌘ for Mac, Ctrl for Windows/Linux)

#### 1.2 New Essential Commands

- [ ] Recent Documents sub-palette (`Ctrl+E`)
- [ ] Jump to Today's Journal (`Ctrl+T`)
- [ ] Save Document command (`Ctrl+S` in editor)
- [ ] Toggle Sidebar command (`Ctrl+B`)
- [ ] Show Help command (`?` or `F1`)

#### 1.3 Sidebar Settings

- [ ] Add `SidebarVisible` field to backend config (default: `false`)
- [ ] Implement `GetSidebarVisible()` / `SetSidebarVisible()` methods
- [ ] Create `useSidebarSetting` hook for frontend persistence
- [ ] Update `Layout.tsx` to use persisted setting
- [ ] Add CSS transitions for smooth toggle (200ms ease-out)

### Phase 2: Enhanced Navigation (P1)

Improve context-awareness and visual differentiation.

#### 2.1 Context-Aware Palette

- [ ] Add document selection context tracking
- [ ] Implement context-based command filtering
- [ ] Add dynamic command text (e.g., "New Document in @work")
- [ ] Implement Quick Switch (`Ctrl+Tab`) between projects

#### 2.2 Visual Differentiation

- [ ] Add mode icons to page headers (FileText/BookOpen)
- [ ] Implement `[data-mode]` CSS variable system for accent colors
- [ ] Create context bar component with breadcrumb navigation
- [ ] Update focus ring colors per mode

#### 2.3 Footer Hint Bar

- [ ] Create `FooterHintBar` component
- [ ] Define context-specific hint configurations (5 contexts)
- [ ] Implement responsive collapse for narrow viewports

#### 2.4 Settings UI

- [ ] Add "Show Sidebar" toggle to Appearance section
- [ ] Add screen reader announcements for sidebar state changes

### Phase 3: Command Line Transition (P1)

Migrate from vim-style commands to Quick Create.

#### 3.1 Deprecation Phase

- [ ] Add deprecation warnings for `:command` syntax
- [ ] Show "Use Ctrl+K for [command]" suggestions
- [ ] Document migration path in Help modal

#### 3.2 Quick Create Input

- [ ] Create `QuickCreateInput` component
- [ ] Implement plain text → document creation (Enter)
- [ ] Implement plain text → journal entry creation (Shift+Enter)
- [ ] Add hint badges showing both modes
- [ ] Remove `:command` parsing

### Phase 4: Discoverability Polish (P1-P2)

Improve learning curve and progressive disclosure.

#### 4.1 Help Modal Redesign

- [ ] Reorganize into 6 collapsible sections
- [ ] Implement context-aware default expansion
- [ ] Add search/filter functionality within modal

#### 4.2 Search Enhancements

- [ ] Implement recency tracking in localStorage
- [ ] Add frequency-based command prioritization
- [ ] Enable searching by keyboard shortcut text

### Phase 5: Advanced Discoverability (P2)

Progressive disclosure and onboarding.

#### 5.1 Tooltip System

- [ ] Create fade-after-use tracking (5 views threshold)
- [ ] Build tooltip component with delay and fade logic
- [ ] Add tooltips to key interactive elements
- [ ] Add Settings toggle for "Show shortcut tooltips"

#### 5.2 Onboarding

- [ ] Create first-run welcome overlay
- [ ] Implement milestone tracking
- [ ] Add progressive hint system (5/10/etc. threshold triggers)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Command palette opens per session | 5+ average | Usage analytics |
| Sidebar enablement rate | <30% of users | Settings analytics |
| Keyboard shortcut usage | 40% increase | Usage analytics |
| "How do I navigate?" support requests | 50% reduction | Support tickets |
| User satisfaction | No decrease | NPS/feedback |

---

## Migration Considerations

### Existing Users

Users upgrading will experience:

1. **Sidebar hidden by default** - First-run tooltip explains `Ctrl+K` and `Ctrl+B`
2. **Command line syntax deprecated** - Gentle warnings guide to palette
3. **No data migration needed** - All changes are UI/UX; no data format changes

### Rollback Plan

If user feedback is strongly negative:

1. Change sidebar default to `true` in patch release
2. Re-enable `:command` parsing as "legacy mode"
3. A/B test different defaults with new users

---

## Related Resources

### Design Documents

- [[mental-model]] - Core concepts and relationships
- [[navigation/command-palette-design]] - Command palette specifications
- [[navigation/quick-access]] - Unified navigation system
- [[settings/sidebar-toggle]] - Sidebar settings design
- [[visual/differentiation]] - Visual language for Documents vs Journal
- [[discoverability/shortcuts]] - Keyboard shortcut visibility strategy

### Architecture Decisions

- [[decisions/adr-001-command-palette-first]] - Primary navigation paradigm
- [[decisions/adr-002-sidebar-optional]] - Sidebar off by default
- [[decisions/adr-003-command-line-fate]] - Command line simplification

---

## Document Status

| Section | Status |
|---------|--------|
| Mental Model | Complete |
| Command Palette Design | Complete |
| Sidebar Toggle | Complete |
| Visual Differentiation | Complete |
| Shortcut Discoverability | Complete |
| Quick Access System | Complete |
| ADR-001 (Palette First) | Proposed |
| ADR-002 (Sidebar Optional) | Proposed |
| ADR-003 (Command Line) | Proposed |
| **This Summary** | Complete |

---

*This document was created as part of Phase 02: Information Architecture Redesign. All designs are proposals awaiting user review and approval before implementation.*
