---
type: architecture
title: Visual Differentiation Strategy - Documents vs Journal
created: 2026-02-01
tags:
  - ux-redesign
  - visual
  - documents
  - journal
related:
  - "[[mental-model]]"
  - "[[command-palette-design]]"
  - "[[sidebar-toggle]]"
  - "[[adr-001-command-palette-first]]"
---

# Visual Differentiation Strategy: Documents vs Journal

This document defines the visual language that distinguishes Documents from Journal, reinforcing the mental model established in [[mental-model]]. The goal is to create instant recognition of context while maintaining the minimal chrome philosophy of keyboard-first design.

---

## Design Philosophy

Visual differentiation should be **subtle but unmistakable**. Users should know at a glance whether they're in Documents or Journal without needing to read text labels. However, differentiation must not create visual noise that distracts from content or conflicts with keyboard-first minimalism.

### Guiding Principles

1. **Content First** - Differentiation should enhance, not compete with, content visibility
2. **Consistent Patterns** - Both areas share the same interaction patterns (selection, navigation, status bars)
3. **Semantic Color** - Color differences should carry meaning, not just decoration
4. **Icon Clarity** - Icons should be immediately recognizable and contextually appropriate
5. **Minimal Chrome** - Keep visual elements sparse; let content breathe

---

## Current State Analysis

### Shared Visual Elements (Intentional)

| Element | Documents | Journal | Status |
|---------|-----------|---------|--------|
| Entry list pattern | Border-left color coding | Border-left color coding | Keep identical |
| Selection indicator | Checkmark button | Checkmark button | Keep identical |
| Hover effects | `hover:bg-surface/60` | `hover:bg-surface/60` | Keep identical |
| Status bar position | Bottom fixed | Bottom fixed | Keep identical |
| Text colors | `text-text`, `text-text-dim` | `text-text`, `text-text-dim` | Keep identical |

### Current Differences

| Element | Documents | Journal |
|---------|-----------|---------|
| Header content | Command line input | Date picker with navigation |
| Status bar actions | Export Markdown/PDF | Promote to Doc, Delete |
| Entry metadata | Updated date | Timestamp (time) |

### Gap Identified

No visual signals establish a distinct "mode" identity. Users rely on reading the breadcrumb text to confirm their location.

---

## Proposed Differentiation Strategy

### 1. Header/Context Bar Styling

The header area is the primary location for establishing visual identity. Each mode gets a distinct header treatment.

#### Documents Header Design

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────────────────────────┐   │
│ │ [FileText]  Documents                              @personal ▾       │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ ┌──────────────────────────────────────────────────────────────────────┐   │
│ │ what did you ship today?                                      Ctrl+D│   │
│ └──────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

**Specifications:**

| Property | Value |
|----------|-------|
| Mode icon | `FileText` (Lucide) |
| Mode label | "Documents" |
| Accent underline | `--color-accent` (#58a6ff, blue) |
| Project selector | Right-aligned dropdown |
| Command line | Below header, blue accent border |

#### Journal Header Design

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────────────────────────┐   │
│ │ [BookOpen]  Journal                                @personal ▾       │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ ┌──────────────────────────────────────────────────────────────────────┐   │
│ │  ◀  │  Wednesday, January 15, 2026  │  ▶  │  Today                  │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

**Specifications:**

| Property | Value |
|----------|-------|
| Mode icon | `BookOpen` (Lucide) |
| Mode label | "Journal" |
| Accent underline | `--color-purple` (#a371f7, purple) |
| Project selector | Right-aligned dropdown |
| Date navigation | Below header, purple accent elements |

#### CSS Implementation

```css
/* Header mode indicator */
.page-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 2px solid transparent;
}

.page-header[data-mode="documents"] {
  border-bottom-color: var(--color-accent);
}

.page-header[data-mode="journal"] {
  border-bottom-color: var(--color-purple);
}

.page-header .mode-icon {
  width: 20px;
  height: 20px;
}

.page-header[data-mode="documents"] .mode-icon {
  color: var(--color-accent);
}

.page-header[data-mode="journal"] .mode-icon {
  color: var(--color-purple);
}

.page-header .mode-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-bright);
}
```

---

### 2. Iconography Differences

Icons provide instant visual recognition. Each concept in the mental model has a designated icon.

#### Icon Assignment Table

| Concept | Icon | Lucide Name | Color | Usage Context |
|---------|------|-------------|-------|---------------|
| **Documents (mode)** | 📄 | `FileText` | `--color-accent` (blue) | Page header, sidebar, palette |
| **Journal (mode)** | 📖 | `BookOpen` | `--color-purple` | Page header, sidebar, palette |
| **Single document** | 📄 | `File` | `--color-text-dim` | Document list item |
| **Journal entry** | ○ | `Circle` | `--color-text-dim` | Entry list item (current) |
| **Today's journal** | 📅 | `Calendar` | `--color-purple` | "Jump to Today" command |
| **Quick Capture** | ⚡ | `Zap` | `--color-yellow` | System tray, notifications |
| **Project** | 📁 | `Folder` | `--color-orange` | Sidebar, project selector |

#### Icon Rationale

- **FileText vs BookOpen**: Documents are structured pages (file metaphor); Journal is a continuous stream (book metaphor)
- **File vs Circle**: Individual documents have full file structure; journal entries are atomic points in time
- **Calendar**: Reinforces time-based organization of Journal
- **Zap**: Quick Capture is fast, ephemeral - lightning conveys speed

#### Icon Display in List Items

**Documents List Item:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ │ 1. [File] Project Roadmap                                               │
│ │          @work · Updated 2 hours ago · #planning #roadmap               │
└────────────────────────────────────────────────────────────────────────────┘
```

**Journal Entry Item:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ │ 1. [Circle] Need to follow up on the API documentation                  │
│ │              @work · 14:32 · #todo                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

**Note:** The existing `Circle` icon for journal entries works well - it represents a point in time. Consider using a filled circle (`CircleDot`) for entries with content, empty circle for placeholders.

---

### 3. Color Accent Differences

Each mode has a designated accent color for interactive elements. Colors are drawn from the existing theme palette to maintain consistency.

#### Color Assignment

| Mode | Primary Accent | CSS Variable | Hex Value | Usage |
|------|---------------|--------------|-----------|-------|
| **Documents** | Blue | `--color-accent` | #58a6ff | Header underline, selection highlight, command line focus |
| **Journal** | Purple | `--color-purple` | #a371f7 | Header underline, date picker, selection highlight |

#### Color Application Matrix

| UI Element | Documents Color | Journal Color |
|------------|----------------|---------------|
| Header underline | Blue | Purple |
| Mode icon | Blue | Purple |
| Selected item border-left | Blue | Purple |
| Focused input border | Blue | Purple |
| Primary action button | Blue | Purple |
| Status bar action text | Blue | Purple |

#### CSS Variables for Mode Theming

```css
/* Define mode-specific accent */
[data-mode="documents"] {
  --mode-accent: var(--color-accent);  /* Blue */
}

[data-mode="journal"] {
  --mode-accent: var(--color-purple);  /* Purple */
}

/* Generic usage of mode accent */
.selected-item {
  border-left-color: var(--mode-accent);
}

.primary-action {
  color: var(--mode-accent);
}

.page-header {
  border-bottom-color: var(--mode-accent);
}
```

#### Visual Example

**Documents Mode (Blue Accent):**
```
┌─────────────────────────────────────────────────────────────────┐
│ [FileText] Documents                               @personal    │
│─────────────────────────────────────────────────────────────────│
│ ▌ 1. Project Roadmap                              2 hours ago   │ ← Blue border
│   2. Meeting Notes                                yesterday     │
│   3. API Documentation                            3 days ago    │
└─────────────────────────────────────────────────────────────────┘
```

**Journal Mode (Purple Accent):**
```
┌─────────────────────────────────────────────────────────────────┐
│ [BookOpen] Journal                                 @personal    │
│─────────────────────────────────────────────────────────────────│
│ ▌ 1. Follow up on API docs                        14:32         │ ← Purple border
│   2. Team standup notes                           10:15         │
│   3. Morning thoughts                             08:22         │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4. Layout Differences

Layout structure reinforces the different mental models of Documents (structured knowledge base) vs Journal (time-indexed stream).

#### Documents Layout: List/Grid with Sorting

**Primary View: Sorted List**
- Entries sorted by: Last modified (default), Title, Created date
- Sortable via command palette: "Sort by..."
- Optional: Grid view for visual scanning (future enhancement)
- Command line anchored at bottom for quick entry

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [FileText] Documents                                         @personal     │
│────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  1. Project Roadmap                               @work    2 hours ago     │
│  2. Meeting Notes - Q1 Planning                   @work    yesterday       │
│  3. API Documentation Draft                       @work    3 days ago      │
│  4. Personal Goals 2026                      @personal    1 week ago       │
│  5. Book Notes: Atomic Habits                @personal    2 weeks ago      │
│                                                                             │
│                         (scrollable content area)                          │
│                                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│ what did you ship today?                                          Ctrl+D   │
├────────────────────────────────────────────────────────────────────────────┤
│ 5 documents · Ctrl+K for commands                                          │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key Layout Properties:**
- Full-width list items
- Clear metadata alignment (right-aligned dates)
- Persistent command line for quick document creation
- Sorting controls accessible via command palette

#### Journal Layout: Date-Focused Timeline

**Primary View: Single Day Timeline**
- Date picker prominent in header
- Entries grouped by time of day
- Visual timeline indicator (optional future enhancement)
- No command line (entries created via Quick Capture)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [BookOpen] Journal                                           @personal     │
├────────────────────────────────────────────────────────────────────────────┤
│         ◀   Wednesday, January 15, 2026   ▶        [Today]                 │
│────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  AFTERNOON                                                                  │
│  ─────────────────────────────────────────────────────────                 │
│  1. [○] Follow up on API documentation             14:32    #todo          │
│  2. [○] Great meeting with design team             13:45    #meeting       │
│                                                                             │
│  MORNING                                                                    │
│  ─────────────────────────────────────────────────────────                 │
│  3. [○] Team standup - discussed roadmap           10:15    #standup       │
│  4. [○] Coffee and planning session                08:22                   │
│                                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│ 4 entries · Press Ctrl+← / Ctrl+→ to navigate days                         │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key Layout Properties:**
- Date navigation is primary interaction
- Time-of-day groupings (Morning, Afternoon, Evening)
- Timestamp displayed prominently per entry
- No command line (Quick Capture is the entry mechanism)
- Keyboard hints in status bar for day navigation

#### Time-of-Day Groupings (Optional Enhancement)

| Group | Time Range | Divider Label |
|-------|------------|---------------|
| Morning | 05:00 - 11:59 | "MORNING" |
| Afternoon | 12:00 - 17:59 | "AFTERNOON" |
| Evening | 18:00 - 21:59 | "EVENING" |
| Night | 22:00 - 04:59 | "NIGHT" |

Implementation note: Groupings are a future enhancement. Initial implementation can show flat list sorted by time descending.

---

### 5. Breadcrumb/Context Indicator Design

A persistent context indicator ensures users always know their location, even without the sidebar.

#### Context Bar Component

The context bar appears at the top of the main content area, below any application header.

**Documents Context:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ [FileText] Documents  ›  @personal                                [Ctrl+K] │
└────────────────────────────────────────────────────────────────────────────┘
```

**Journal Context:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ [BookOpen] Journal  ›  @personal  ›  Jan 15, 2026                 [Ctrl+K] │
└────────────────────────────────────────────────────────────────────────────┘
```

**Single Document Context:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ [FileText] Documents  ›  @work  ›  Project Roadmap                [Ctrl+K] │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Context Bar Specifications

```css
.context-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
}

.context-bar .mode-icon {
  width: 16px;
  height: 16px;
  color: var(--mode-accent);
}

.context-bar .mode-label {
  font-weight: 500;
  color: var(--color-text-bright);
}

.context-bar .separator {
  color: var(--color-text-dim);
}

.context-bar .breadcrumb-item {
  color: var(--color-text);
}

.context-bar .breadcrumb-item:last-child {
  color: var(--color-text-bright);
}

.context-bar .command-hint {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-dim);
  padding: 2px 6px;
  background: var(--color-bg);
  border-radius: 4px;
}
```

#### Breadcrumb Hierarchy

| Context | Breadcrumb Path |
|---------|-----------------|
| Documents list | `[FileText] Documents › @project` |
| Single document | `[FileText] Documents › @project › Document Title` |
| Journal (date view) | `[BookOpen] Journal › @project › Jan 15, 2026` |
| Settings | `[Settings] Settings › Section Name` |
| Search | `[Search] Search › "query"` |

#### Keyboard Interaction

- Clicking mode icon/label navigates to mode home (Documents list or Journal today)
- Clicking project navigates to project settings (future)
- `Ctrl+K` hint is clickable and opens command palette
- Breadcrumb items are focusable via Tab for accessibility

---

### 6. Keyboard-First Visual Language

All visual differentiation must support, not hinder, keyboard-first interaction.

#### Principles

1. **No Mouse-Only Affordances** - Every visual element that indicates interactivity must be keyboard accessible
2. **Focus Indicators Use Mode Color** - Focus rings match the current mode's accent color
3. **Shortcuts Visible** - Keyboard shortcuts displayed where relevant (status bar, command hints)
4. **Minimal Hover States** - Don't rely on hover for critical information; it's inaccessible to keyboard users

#### Focus Ring Styling

```css
/* Mode-aware focus ring */
[data-mode="documents"] :focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

[data-mode="journal"] :focus-visible {
  outline: 2px solid var(--color-purple);
  outline-offset: 2px;
}
```

#### Status Bar Keyboard Hints

The status bar always shows relevant keyboard shortcuts for the current context.

**Documents Status Bar:**
```
5 documents · Ctrl+N new · Ctrl+K commands · ↑↓ navigate
```

**Journal Status Bar:**
```
4 entries · Ctrl+← prev day · Ctrl+→ next day · Ctrl+T today
```

#### Visual Summary: Keyboard-First Compliance

| Visual Element | Keyboard Accessible? | Implementation |
|----------------|---------------------|----------------|
| Mode icon | Yes | Focus on header, Enter navigates home |
| Breadcrumb items | Yes | Tab-focusable, Enter navigates |
| List items | Yes | Arrow keys navigate, Enter opens |
| Date picker | Yes | Arrow keys change date, Enter confirms |
| Status bar actions | Yes | Keyboard shortcuts shown inline |
| Context indicator | Yes | Part of focus sequence |

---

## Implementation Checklist

### Phase 1: Core Visual Identity
- [ ] Add mode icon (`FileText`/`BookOpen`) to page headers
- [ ] Add header underline with mode-specific color
- [ ] Create `[data-mode]` CSS variable system
- [ ] Update focus ring colors per mode

### Phase 2: Iconography
- [ ] Add `File` icon to document list items
- [ ] Ensure `Circle` icon on journal entries (already present)
- [ ] Update sidebar icons for Documents/Journal
- [ ] Update command palette icons per command group

### Phase 3: Layout Refinements
- [ ] Implement context bar component
- [ ] Add time-of-day groupings to Journal (optional)
- [ ] Update status bar hints per page context

### Phase 4: Polish
- [ ] Audit all focus states for mode-awareness
- [ ] Test with screen reader for proper announcements
- [ ] Verify all keyboard shortcuts match visual hints
- [ ] Test color contrast for accessibility compliance

---

## Accessibility Considerations

### Color Contrast

All accent colors must meet WCAG 2.1 AA contrast requirements:

| Color | Hex | On Dark BG (#0d1117) | Contrast Ratio | Status |
|-------|-----|---------------------|----------------|--------|
| Blue (accent) | #58a6ff | ✓ | 7.2:1 | Pass |
| Purple | #a371f7 | ✓ | 5.8:1 | Pass |
| Text | #c9d1d9 | ✓ | 9.1:1 | Pass |
| Text Dim | #8b949e | ✓ | 4.6:1 | Pass (AA) |

### Screen Reader Support

| Element | Announcement |
|---------|--------------|
| Mode icon | "Documents mode" / "Journal mode" |
| Context bar | "Currently viewing: Documents, Personal project" |
| Date change | "Viewing January 15, 2026" |
| Mode switch | "Switched to Journal mode" |

### Reduced Motion

Users with `prefers-reduced-motion` should see instant transitions:

```css
@media (prefers-reduced-motion: reduce) {
  .page-header,
  .context-bar,
  .mode-icon {
    transition: none;
  }
}
```

---

## Related Documentation

- [[mental-model]] - Core concepts defining Documents vs Journal
- [[command-palette-design]] - Command groupings and icons
- [[sidebar-toggle]] - Sidebar-off-by-default context
- [[adr-001-command-palette-first]] - Decision record for keyboard-first paradigm
- [[discoverability-friction]] - UX audit findings this design addresses
