---
type: architecture
title: Keyboard Shortcut Discoverability
created: 2026-02-01
tags:
  - ux-redesign
  - discoverability
  - keyboard-shortcuts
related:
  - "[[mental-model]]"
  - "[[command-palette-design]]"
  - "[[differentiation]]"
  - "[[sidebar-toggle]]"
  - "[[adr-001-command-palette-first]]"
---

# Keyboard Shortcut Discoverability

This document defines the strategy for making keyboard shortcuts discoverable to users. In a command-palette-first interface, shortcuts are the primary interaction mechanism—users must be able to learn them progressively without explicit memorization.

---

## Design Philosophy

Discoverability follows the principle of **progressive mastery**: users start with the command palette (visual, searchable) and naturally graduate to direct keyboard shortcuts as they see them repeatedly. The system should:

1. **Show, don't tell** - Display shortcuts in context where they're used
2. **Reward curiosity** - Users who explore the palette learn shortcuts passively
3. **Fade when learned** - Reduce visual noise for experienced users
4. **Never block** - Learning aids should never interrupt workflow

---

## Current State Analysis

### Existing Shortcut Display Mechanisms

| Location | Current Behavior | Gap Identified |
|----------|-----------------|----------------|
| Command palette | Shows description, not shortcut | Shortcuts hidden |
| Help modal | Lists all shortcuts | No grouping, overwhelming |
| Status bar | Minimal hints | Context-unaware |
| Tooltips | None | No progressive disclosure |
| In-app guidance | None | No onboarding path |

### Friction Points

1. **Palette hides shortcuts** - Users search for commands but don't see the shortcut they could use directly
2. **Help modal is a wall of text** - Too many shortcuts listed without context makes it hard to find relevant ones
3. **No context-aware hints** - Status bar doesn't adapt to current page/mode
4. **No learning curve** - First-time users and power users see the same interface

---

## 1. Command Palette Hint Badges

### Design Specification

Every command in the palette that has an associated keyboard shortcut displays a **hint badge** aligned to the right of the command text. This is the primary mechanism for shortcut discovery.

### Badge Visual Design

```
┌────────────────────────────────────────────────────────────────┐
│ Type a command...                                       Esc    │
├────────────────────────────────────────────────────────────────┤
│ Navigation                                                     │
│ ───────────────────────────────────────────────────────────── │
│ [LayoutDashboard] Go to Dashboard                              │
│ [Search]          Go to Search                   Ctrl+Shift+F  │
│ [BookOpen]        Go to Journal                       Ctrl+J   │
│ [Settings]        Go to Settings                      Ctrl+,   │
│ [Calendar]        Jump to Today                       Ctrl+T   │
│ [Clock]           Recent Documents                    Ctrl+E   │
│                                                                │
│ Create                                                         │
│ ───────────────────────────────────────────────────────────── │
│ [FilePlus]        New Document                        Ctrl+N   │
│ [BookPlus]        New Journal Entry               Ctrl+Shift+N │
└────────────────────────────────────────────────────────────────┘
```

### Badge Styling

```css
.command-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 12px;
}

.command-text {
  flex: 1;
  font-size: 14px;
  color: var(--color-text);
}

.command-shortcut-badge {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-dim);
  padding: 2px 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  white-space: nowrap;
  min-width: fit-content;
}

/* Hover state - highlight the shortcut */
.command-item[aria-selected="true"] .command-shortcut-badge {
  background: var(--color-bg);
  border-color: var(--color-text-dim);
}
```

### Platform-Specific Key Symbols

| Platform | Modifier | Display | Example |
|----------|----------|---------|---------|
| macOS | Command | `⌘` | `⌘N` |
| macOS | Option | `⌥` | `⌥⌘S` |
| macOS | Shift | `⇧` | `⇧⌘F` |
| macOS | Control | `⌃` | `⌃⌘Space` |
| Windows/Linux | Ctrl | `Ctrl` | `Ctrl+N` |
| Windows/Linux | Alt | `Alt` | `Alt+F4` |
| Windows/Linux | Shift | `Shift` | `Ctrl+Shift+F` |

### Badge Rendering Logic

```typescript
interface ShortcutBadgeProps {
  shortcut: string; // e.g., "Ctrl+N" or "Cmd+Shift+F"
  platform: 'mac' | 'windows' | 'linux';
}

function formatShortcut(shortcut: string, platform: string): string {
  if (platform === 'mac') {
    return shortcut
      .replace('Ctrl+', '⌃')
      .replace('Cmd+', '⌘')
      .replace('Alt+', '⌥')
      .replace('Shift+', '⇧')
      .replace(/\+/g, ''); // Remove remaining + separators for Mac
  }
  return shortcut; // Windows/Linux use text format
}

// Example outputs:
// formatShortcut('Ctrl+Shift+F', 'mac') => '⌃⇧F'
// formatShortcut('Cmd+N', 'mac') => '⌘N'
// formatShortcut('Ctrl+N', 'windows') => 'Ctrl+N'
```

### Commands Without Shortcuts

Commands that lack a keyboard shortcut display a brief description instead of a badge. The description uses muted styling to differentiate from shortcut badges.

```
│ [FolderInput]     Move to Project...        Relocate document  │
│ [ArrowRight]      Switch to @work              Switch project  │
```

```css
.command-description {
  font-size: 11px;
  color: var(--color-text-dim);
  font-style: italic;
}
```

---

## 2. Footer Hint Bar

### Purpose

The footer hint bar provides persistent, context-aware keyboard hints at the bottom of the main content area. It shows the most relevant shortcuts for the current page without requiring users to open the help modal.

### Design Specification

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                     [Main Content Area]                        │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ Ctrl+K commands  ·  Ctrl+N new  ·  ↑↓ navigate  ·  ? help     │
└────────────────────────────────────────────────────────────────┘
```

### Context-Specific Hints

The hint bar adapts based on the current page/mode:

| Context | Hints Displayed |
|---------|-----------------|
| **Dashboard (Documents)** | `Ctrl+K commands · Ctrl+N new · ↑↓ navigate · Enter open · ? help` |
| **Journal Page** | `Ctrl+← prev day · Ctrl+→ next day · Ctrl+T today · ↑↓ select · ? help` |
| **Document Editor** | `Ctrl+S save · Ctrl+K commands · Esc close · ? help` |
| **Settings** | `Ctrl+K commands · Tab sections · Esc close · ? help` |
| **Search Results** | `↑↓ navigate · Enter open · Ctrl+K commands · Esc clear` |
| **Command Palette Open** | `↑↓ select · Enter execute · Esc close · Tab groups` |

### Visual Design

```css
.footer-hint-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 8px 16px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-dim);
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hint-key {
  font-family: var(--font-mono);
  padding: 1px 4px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  font-size: 11px;
}

.hint-separator {
  color: var(--color-border);
}
```

### Hint Bar Component

```typescript
interface HintItem {
  key: string;      // e.g., "Ctrl+K"
  action: string;   // e.g., "commands"
}

interface FooterHintBarProps {
  context: 'dashboard' | 'journal' | 'editor' | 'settings' | 'search';
}

const contextHints: Record<string, HintItem[]> = {
  dashboard: [
    { key: 'Ctrl+K', action: 'commands' },
    { key: 'Ctrl+N', action: 'new' },
    { key: '↑↓', action: 'navigate' },
    { key: 'Enter', action: 'open' },
    { key: '?', action: 'help' },
  ],
  journal: [
    { key: 'Ctrl+←', action: 'prev day' },
    { key: 'Ctrl+→', action: 'next day' },
    { key: 'Ctrl+T', action: 'today' },
    { key: '↑↓', action: 'select' },
    { key: '?', action: 'help' },
  ],
  editor: [
    { key: 'Ctrl+S', action: 'save' },
    { key: 'Ctrl+K', action: 'commands' },
    { key: 'Esc', action: 'close' },
    { key: '?', action: 'help' },
  ],
  settings: [
    { key: 'Ctrl+K', action: 'commands' },
    { key: 'Tab', action: 'sections' },
    { key: 'Esc', action: 'close' },
    { key: '?', action: 'help' },
  ],
  search: [
    { key: '↑↓', action: 'navigate' },
    { key: 'Enter', action: 'open' },
    { key: 'Ctrl+K', action: 'commands' },
    { key: 'Esc', action: 'clear' },
  ],
};
```

### Responsive Behavior

On narrow viewports (< 640px), the hint bar collapses to show only the most essential hints:

| Viewport | Hints Shown |
|----------|-------------|
| Wide (> 640px) | All context hints (5-6 items) |
| Narrow (< 640px) | Essential only: `Ctrl+K · ↑↓ · ? help` |

```css
@media (max-width: 640px) {
  .footer-hint-bar .hint-item:not(.essential) {
    display: none;
  }
}
```

---

## 3. Improved Help Modal Organization

### Current Problems

The existing help modal presents shortcuts as a flat list, making it difficult to:
- Find shortcuts relevant to the current task
- Understand the relationship between shortcuts
- Remember shortcuts grouped by function

### Redesigned Help Modal

The help modal is reorganized into **collapsible sections** that mirror the command palette groups and page contexts.

### Visual Design

```
┌────────────────────────────────────────────────────────────────┐
│ Keyboard Shortcuts                                       [×]   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ▼ Global Shortcuts                                             │
│   ─────────────────────────────────────────────────────────── │
│   Ctrl+K         Open command palette                          │
│   Ctrl+B         Toggle sidebar                                │
│   Ctrl+,         Open settings                                 │
│   ?  or  F1      Show this help                                │
│                                                                │
│ ▼ Navigation                                                   │
│   ─────────────────────────────────────────────────────────── │
│   Ctrl+J         Go to Journal                                 │
│   Ctrl+T         Jump to Today's Journal                       │
│   Ctrl+E         Recent Documents                              │
│   Ctrl+Tab       Switch to last project                        │
│   Ctrl+Shift+F   Go to Search                                  │
│                                                                │
│ ▶ Documents (collapsed)                                        │
│                                                                │
│ ▶ Journal (collapsed)                                          │
│                                                                │
│ ▶ Editor (collapsed)                                           │
│                                                                │
│ ▶ Git Operations (collapsed)                                   │
│                                                                │
│                                         [Close]                │
└────────────────────────────────────────────────────────────────┘
```

### Section Definitions

| Section | Shortcuts Included | Default State |
|---------|-------------------|---------------|
| **Global Shortcuts** | Palette, sidebar, settings, help | Expanded |
| **Navigation** | Page navigation, project switching | Expanded |
| **Documents** | New, save, export, archive, delete | Collapsed |
| **Journal** | Day navigation, promote, delete entries | Collapsed |
| **Editor** | Formatting, save, undo/redo | Collapsed |
| **Git Operations** | Sync, push, pull, status | Collapsed |

### Context-Aware Expansion

When the help modal is opened, sections relevant to the current page auto-expand:

| Current Page | Auto-Expanded Sections |
|--------------|------------------------|
| Dashboard | Global, Navigation, Documents |
| Journal | Global, Navigation, Journal |
| Document Editor | Global, Editor |
| Settings | Global only |

### CSS Styling

```css
.help-modal {
  width: 480px;
  max-height: 70vh;
  overflow-y: auto;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.24);
}

.help-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  font-size: 16px;
  font-weight: 600;
}

.help-section {
  border-bottom: 1px solid var(--color-border);
}

.help-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  font-weight: 500;
  color: var(--color-text-bright);
}

.help-section-header:hover {
  background: var(--color-surface);
}

.help-section-chevron {
  width: 16px;
  height: 16px;
  transition: transform 150ms ease;
}

.help-section[data-expanded="true"] .help-section-chevron {
  transform: rotate(90deg);
}

.help-section-content {
  padding: 0 16px 12px 40px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  padding: 6px 0;
  gap: 16px;
}

.shortcut-key {
  font-family: var(--font-mono);
  font-size: 12px;
  min-width: 120px;
  color: var(--color-text-dim);
}

.shortcut-description {
  font-size: 13px;
  color: var(--color-text);
}
```

### Search Within Help

Add a search input at the top of the modal to filter shortcuts:

```
┌────────────────────────────────────────────────────────────────┐
│ Keyboard Shortcuts                                       [×]   │
├────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Search shortcuts...                                        │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│ ▼ Showing results for "save"                                   │
│   Ctrl+S         Save document                                 │
│   Ctrl+Shift+S   Git sync (save to remote)                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Learn-As-You-Go Tooltip System

### Purpose

Tooltips provide contextual shortcut hints that appear when users hover over or focus on UI elements. Unlike static hints, these tooltips **fade after repeated use**, reducing visual noise for experienced users.

### Fade-After-Use Algorithm

```typescript
interface TooltipUsage {
  elementId: string;
  seenCount: number;
  lastSeen: number;
}

const TOOLTIP_FADE_THRESHOLD = 5; // Hide after seen 5 times
const TOOLTIP_RESET_DAYS = 30;    // Reset count after 30 days of no use

function shouldShowTooltip(elementId: string): boolean {
  const usage = getTooltipUsage(elementId);

  if (!usage) return true; // First time seeing this element

  // Reset if not seen in 30 days
  const daysSinceLastSeen = (Date.now() - usage.lastSeen) / (1000 * 60 * 60 * 24);
  if (daysSinceLastSeen > TOOLTIP_RESET_DAYS) {
    resetTooltipUsage(elementId);
    return true;
  }

  return usage.seenCount < TOOLTIP_FADE_THRESHOLD;
}

function recordTooltipView(elementId: string): void {
  const usage = getTooltipUsage(elementId) || { elementId, seenCount: 0, lastSeen: 0 };
  usage.seenCount++;
  usage.lastSeen = Date.now();
  saveTooltipUsage(usage);
}

// Storage: localStorage key 'yanta_tooltip_usage'
```

### Tooltip Placement

Tooltips appear on interactive elements that have keyboard shortcuts:

| Element | Shortcut Shown | Tooltip Text |
|---------|---------------|--------------|
| Sidebar "Dashboard" link | - | "View all documents" |
| Sidebar "Journal" link | `Ctrl+J` | "Go to Journal (Ctrl+J)" |
| "New Document" button | `Ctrl+N` | "New Document (Ctrl+N)" |
| Save button (editor) | `Ctrl+S` | "Save (Ctrl+S)" |
| Search input | `Ctrl+Shift+F` | "Search all content" |
| Command palette button | `Ctrl+K` | "Open command palette (Ctrl+K)" |

### Tooltip Visual Design

```css
.shortcut-tooltip {
  position: absolute;
  padding: 6px 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 12px;
  color: var(--color-text);
  white-space: nowrap;
  z-index: 1000;
  pointer-events: none;

  /* Fade-in animation */
  opacity: 0;
  transform: translateY(4px);
  animation: tooltip-appear 150ms ease forwards;
  animation-delay: 500ms; /* Delay before showing */
}

@keyframes tooltip-appear {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.shortcut-tooltip .tooltip-shortcut {
  font-family: var(--font-mono);
  padding: 1px 4px;
  margin-left: 6px;
  background: var(--color-surface);
  border-radius: 3px;
  font-size: 11px;
  color: var(--color-text-dim);
}
```

### Tooltip Trigger Behavior

| Trigger | Delay | Duration |
|---------|-------|----------|
| Mouse hover | 500ms | Until mouse leaves |
| Keyboard focus | 800ms | Until focus leaves |
| Touch (long press) | 300ms | 2 seconds then auto-hide |

### Accessibility Considerations

- Tooltips use `role="tooltip"` and are associated via `aria-describedby`
- Tooltips are never essential for functionality (shortcuts are discoverable elsewhere)
- Users can disable tooltips in Settings > Appearance > "Show shortcut tooltips"

---

## 5. Shortcut Visibility Hierarchy

### Prominent vs. Discoverable Shortcuts

Not all shortcuts deserve equal visibility. This hierarchy defines which shortcuts should be prominently displayed and which should be discoverable through exploration.

### Tier 1: Always Prominent

These shortcuts appear in the footer hint bar, onboarding, and are highlighted in the help modal.

| Shortcut | Reason for Prominence |
|----------|----------------------|
| `Ctrl+K` | **Primary interaction** - Opens command palette |
| `?` or `F1` | **Help access** - Users need to find help easily |
| `↑↓` | **Universal navigation** - Works everywhere |
| `Enter` | **Primary action** - Opens/selects items |
| `Esc` | **Cancel/close** - Universal escape hatch |

### Tier 2: Context-Prominent

These shortcuts appear in the footer hint bar when relevant to the current page.

| Context | Shortcuts |
|---------|-----------|
| Documents | `Ctrl+N`, `Ctrl+S`, `Ctrl+E` (export) |
| Journal | `Ctrl+←`, `Ctrl+→`, `Ctrl+T` |
| Editor | `Ctrl+S`, `Ctrl+B` (bold), `Ctrl+I` (italic) |
| Global | `Ctrl+B` (sidebar), `Ctrl+,` (settings) |

### Tier 3: Discoverable

These shortcuts are shown only in the command palette and help modal. They're for power users who actively explore.

| Category | Shortcuts |
|----------|-----------|
| Git | `Ctrl+Shift+S` (sync), push, pull, status |
| Advanced Document | Archive, delete, duplicate, move |
| Advanced Journal | Promote to document, bulk delete |
| Navigation | `Ctrl+Tab` (last project), recent documents |

### Tier 4: Hidden Power Features

These shortcuts exist but are not displayed anywhere by default. They're documented only in release notes or advanced documentation.

| Shortcut | Function | Reason for Hiding |
|----------|----------|-------------------|
| `Ctrl+Shift+D` | Developer tools | Not for regular users |
| `Ctrl+Shift+R` | Force reload | Rarely needed |
| `Alt+F4` | Quit (Windows) | OS-level, not app-specific |

### Visibility Matrix

| Shortcut | Command Palette | Help Modal | Footer Bar | Tooltip | Onboarding |
|----------|----------------|------------|------------|---------|------------|
| `Ctrl+K` | Yes | Yes (Global) | Always | Yes | Yes |
| `?` | Yes | Yes (Global) | Always | No | Yes |
| `Ctrl+N` | Yes | Yes (Docs) | Documents | Yes | Yes |
| `Ctrl+S` | Yes | Yes (Editor) | Editor | Yes | No |
| `Ctrl+J` | Yes | Yes (Nav) | No | Yes | No |
| `Ctrl+Shift+S` | Yes | Yes (Git) | No | No | No |
| `Ctrl+Tab` | Yes | Yes (Nav) | No | No | No |

---

## 6. Onboarding Integration

### First-Run Experience

On first launch, display a brief overlay highlighting the most important shortcuts:

```
┌────────────────────────────────────────────────────────────────┐
│                     Welcome to YANTA                            │
│                                                                │
│   Your keyboard-first note-taking companion.                   │
│                                                                │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │         Ctrl+K   Open command palette                   │  │
│   │                  Find any command instantly             │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │            ?     View all shortcuts                     │  │
│   │                  See the complete shortcut reference    │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                │
│                                                                │
│   Tip: The command palette shows keyboard shortcuts.           │
│   Use it to learn as you go!                                   │
│                                                                │
│                                    [Got it, let's start]       │
└────────────────────────────────────────────────────────────────┘
```

### Progressive Disclosure Milestones

Track user progress and surface new shortcuts at appropriate milestones:

| Milestone | Trigger | Hint Shown |
|-----------|---------|------------|
| First document created | After save | "Tip: Press Ctrl+S to save quickly" |
| 5 documents created | On dashboard | "Power tip: Ctrl+E opens recent documents" |
| First journal entry | After capture | "Navigate days with Ctrl+← and Ctrl+→" |
| 10 journal entries | On journal page | "Select entries to promote or delete" |
| First project switch | After switch | "Quick switch with Ctrl+Tab" |

### Hint Persistence

Milestone hints appear once and are stored in user preferences:

```typescript
interface UserProgress {
  documentsCreated: number;
  journalEntriesCreated: number;
  projectsSwitched: number;
  hintsShown: string[]; // e.g., ['first-save', 'recent-docs']
}

// Storage: localStorage key 'yanta_user_progress'
```

---

## Implementation Checklist

### Phase 1: Command Palette Badges
- [ ] Add shortcut badge rendering to command items
- [ ] Implement platform-specific key symbol formatting
- [ ] Add description fallback for commands without shortcuts
- [ ] Update cmdk component styling

### Phase 2: Footer Hint Bar
- [ ] Create `FooterHintBar` component
- [ ] Define context-specific hint configurations
- [ ] Add responsive collapse behavior
- [ ] Integrate into Layout component

### Phase 3: Help Modal Redesign
- [ ] Reorganize help modal into collapsible sections
- [ ] Implement context-aware default expansion
- [ ] Add search/filter functionality
- [ ] Update styling for visual hierarchy

### Phase 4: Tooltip System
- [ ] Create fade-after-use tracking in localStorage
- [ ] Build tooltip component with delay and fade logic
- [ ] Add tooltips to key interactive elements
- [ ] Add Settings toggle for "Show shortcut tooltips"

### Phase 5: Onboarding
- [ ] Create first-run welcome overlay
- [ ] Implement milestone tracking
- [ ] Add progressive hint system
- [ ] Store user progress in localStorage

---

## Accessibility Considerations

### Screen Reader Support

| Element | Announcement |
|---------|--------------|
| Shortcut badge | "Keyboard shortcut: Control plus K" |
| Footer hint | "Press Control plus K to open commands" |
| Tooltip | Associated via `aria-describedby` |
| Help modal section | "Global Shortcuts, expanded" / "collapsed" |

### Keyboard Navigation

- Help modal sections are focusable and expandable via Enter/Space
- Tooltips don't trap focus
- Footer hints are read-only (not focusable)

### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  .shortcut-tooltip {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .help-section-chevron {
    transition: none;
  }
}
```

---

## Related Documentation

- [[mental-model]] - Core keyboard-first philosophy
- [[command-palette-design]] - Command groupings and shortcut assignments
- [[differentiation]] - Context bar and mode-specific visual language
- [[sidebar-toggle]] - Sidebar keyboard shortcut details
- [[adr-001-command-palette-first]] - Decision record for command palette primacy
