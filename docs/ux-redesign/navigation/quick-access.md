---
type: architecture
title: Unified Quick Access System Design
created: 2026-02-01
tags:
  - ux-redesign
  - navigation
  - quick-access
related:
  - "[[mental-model]]"
  - "[[command-palette-design]]"
  - "[[discoverability-friction]]"
  - "[[sidebar-toggle]]"
  - "[[adr-001-command-palette-first]]"
  - "[[adr-003-command-line-fate]]"
---

# Unified Quick Access System Design

This document defines the unified quick access system for YANTA, establishing a clear hierarchy of navigation mechanisms and addressing the role of the command line in a command-palette-first interface.

---

## Design Philosophy

The quick access system follows the principle of **single source of truth with layered access**. The command palette is the authoritative interface for all actions, with keyboard shortcuts providing direct access to frequently-used commands and the sidebar offering optional visual navigation for users who prefer it.

### Core Principles

1. **Command Palette is Primary** - Every action flows through or is discoverable via the palette
2. **Shortcuts are Learned, Not Required** - Power users graduate to shortcuts; new users use palette
3. **Sidebar is Optional** - Visual navigation exists for preference, not necessity
4. **Reduce Duplication** - Avoid multiple entry points that do the same thing differently
5. **Context Clarity** - Users always know where they are and what's available

---

## Navigation Hierarchy

### Tier 1: Command Palette (Primary)

The command palette (`Ctrl+K`) is the universal entry point for all navigation and actions. See [[command-palette-design]] for full specifications.

**Characteristics:**
- Always accessible via global shortcut
- Searchable by command name, keywords, and shortcuts
- Shows keyboard shortcuts as badges for learning
- Context-aware command filtering
- Recency and frequency-based ordering

**When to Use:**
- Any navigation task
- Any action (create, delete, export, etc.)
- When you don't remember the direct shortcut
- Exploring available commands

### Tier 2: Keyboard Shortcuts (Power User)

Direct keyboard shortcuts bypass the palette for maximum efficiency. See [[discoverability/shortcuts]] for visibility strategy.

**Characteristics:**
- No UI interaction required
- Memorized through palette badge exposure
- Context-sensitive (some only work on specific pages)
- Reserved for high-frequency actions

**Key Shortcuts:**

| Category | Shortcut | Action |
|----------|----------|--------|
| Navigation | `Ctrl+J` | Go to Journal |
| Navigation | `Ctrl+T` | Jump to Today's Journal |
| Navigation | `Ctrl+E` | Recent Documents |
| Navigation | `Ctrl+Tab` | Switch to Last Project |
| Navigation | `Ctrl+Shift+F` | Go to Search |
| Creation | `Ctrl+N` | New Document |
| Creation | `Ctrl+Shift+N` | New Journal Entry |
| Editing | `Ctrl+S` | Save Document |
| Application | `Ctrl+B` | Toggle Sidebar |
| Application | `Ctrl+,` | Open Settings |

### Tier 3: Sidebar (Optional Visual)

The sidebar provides visual navigation for users who prefer seeing structure. It is **off by default** per [[sidebar-toggle]].

**Characteristics:**
- Optional—disabled by default
- Toggled via `Ctrl+B` or Settings
- Mirrors command palette structure
- Provides persistent project visibility
- No exclusive functionality (everything available via palette)

**When Valuable:**
- Users with many projects needing visual overview
- Users transitioning from mouse-centric applications
- Wide-screen setups with space to spare
- When multitasking requires visible context

---

## Recent Documents in Command Palette

### Design Specification

The "Recent Documents" command (`Ctrl+E`) opens a sub-palette displaying the most recently accessed documents across all projects.

### Behavior

1. **Activation:** User presses `Ctrl+E` or selects "Recent Documents" from palette
2. **Display:** Sub-palette appears with last 10 accessed documents
3. **Selection:** Arrow keys navigate; Enter opens selected document
4. **Filtering:** Type to filter by document title
5. **Escape:** Closes sub-palette, returns to main palette or content

### Sub-Palette Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│ Recent Documents                                         Esc   │
├────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Filter...                                                │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                │
│  1. 📄 UX Audit Summary                @yanta      2 min ago   │
│  2. 📄 Meeting Notes - Q1 Planning     @work       1 hour ago  │
│  3. 📄 Project Roadmap                 @work       yesterday   │
│  4. 📄 API Documentation Draft         @work       yesterday   │
│  5. 📄 Shopping List                   @personal   3 days ago  │
│  6. 📄 Book Notes: Atomic Habits       @personal   1 week ago  │
│                                                                │
│ ───────────────────────────────────────────────────────────    │
│  [↑↓ navigate]  [Enter open]  [Esc close]                      │
└────────────────────────────────────────────────────────────────┘
```

### Data Structure

```typescript
interface RecentDocument {
  id: string;
  title: string;
  projectAlias: string;
  lastAccessedAt: number;  // timestamp
  path: string;            // navigation path
}

interface RecentDocumentsState {
  documents: RecentDocument[];
  maxItems: 10;
}

// Storage: localStorage key 'yanta_recent_documents'
```

### Tracking Logic

```typescript
function recordDocumentAccess(doc: Document): void {
  const recent = getRecentDocuments();

  // Remove if already exists (will re-add at top)
  const filtered = recent.filter(r => r.id !== doc.id);

  // Add to front of list
  filtered.unshift({
    id: doc.id,
    title: doc.title,
    projectAlias: doc.projectAlias,
    lastAccessedAt: Date.now(),
    path: `/document/${doc.id}`,
  });

  // Trim to max 10
  const trimmed = filtered.slice(0, 10);

  saveRecentDocuments(trimmed);
}

// Trigger: Call when user opens a document for viewing/editing
```

### Time Formatting

Display relative time for recency:

| Time Delta | Display |
|------------|---------|
| < 1 minute | "just now" |
| < 60 minutes | "X min ago" |
| < 24 hours | "X hours ago" |
| < 48 hours | "yesterday" |
| < 7 days | "X days ago" |
| ≥ 7 days | "X weeks ago" |

---

## Favorites Concept (Future Feature)

### Purpose

Favorites provide persistent quick access to frequently-used documents and projects, separate from time-based recency.

### Design Specification

Favorites is an **optional future feature** that complements Recent Documents. It is **not in MVP scope** but documented here for future reference.

### Proposed Behavior

1. **Starring:** User can "favorite" a document via palette command or keyboard shortcut
2. **Access:** Favorites appear in a dedicated "Favorites" section in the command palette
3. **Ordering:** Manual ordering via drag-and-drop or move commands
4. **Limit:** Maximum 25 favorites to prevent list bloat
5. **Cross-Project:** Favorites span all projects

### Proposed Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│ Type a command...                                        Esc   │
├────────────────────────────────────────────────────────────────┤
│ ★ Favorites                                                    │
│ ─────────────────────────────────────────────────────────────  │
│ [★] Project Roadmap                                 @work      │
│ [★] Meeting Notes Template                          @work      │
│ [★] Personal Goals 2026                         @personal      │
│                                                                │
│ 🕐 Recent                                                      │
│ ─────────────────────────────────────────────────────────────  │
│ [📄] UX Audit Summary                              @yanta      │
│ [📄] API Documentation                             @work       │
│                                                                │
│ Navigation                                                     │
│ ─────────────────────────────────────────────────────────────  │
│ ...                                                            │
└────────────────────────────────────────────────────────────────┘
```

### Commands for Favorites

| Command | Shortcut | Description |
|---------|----------|-------------|
| Add to Favorites | `Ctrl+Shift+F` | Star current document |
| Remove from Favorites | `Ctrl+Shift+F` (toggle) | Unstar current document |
| View Favorites | via palette | Show favorites sub-palette |

### Implementation Priority

**Status:** Proposed (P2 - Nice to Have)

Rationale: Recent Documents covers 80% of the use case. Favorites add complexity and require storage sync. Defer until user feedback indicates demand.

---

## Command Line: Analysis and Decision

### Current State

The command line is a colon-prefixed (`:command`) text input that appears at the bottom of certain pages. See [[adr-003-command-line-fate]] for the formal decision record.

#### Current Commands

**Document Context:**
- `:new [title]` - Create new document
- `:doc [path]` - Navigate to document
- `:archive [path]` - Archive document(s)
- `:unarchive [path]` - Restore document(s)
- `:delete [path]` - Delete document(s)
- `:tag [tags...]` - Add tags
- `:untag [tags...]` - Remove tags
- `:tags` - Show tags
- `:export-md` - Export to Markdown
- `:export-pdf` - Export to PDF
- `:help` / `?` - Show help

**Project Context:**
- `:new [name] @alias` - Create project
- `:archive @alias` - Archive project
- `:unarchive @alias` - Restore project
- `:rename @alias [name]` - Rename project
- `:delete @alias` - Delete project

**Global Context:**
- `:switch @alias` - Switch project
- `:sync` - Git sync
- `:quit` - Exit application

### Friction Analysis

The command line creates several UX friction points:

| Issue | Impact | Severity |
|-------|--------|----------|
| **Duplicate Functionality** | Same actions available via palette | Medium |
| **Learning Curve** | Users must learn two command systems | High |
| **Context Confusion** | Different commands per page | Medium |
| **Discoverability** | Commands not visible without `:help` | High |
| **Visual Clutter** | Occupies screen space on every page | Low |
| **Shortcut Conflict** | `Shift+;` for focus conflicts with typing | Low |

### Overlap Analysis

| Action | Command Palette | Command Line | Overlap? |
|--------|----------------|--------------|----------|
| New Document | `Ctrl+K` → "New Document" | `:new [title]` | Full |
| Archive Document | `Ctrl+K` → "Archive" | `:archive` | Full |
| Export Markdown | `Ctrl+K` → "Export Markdown" | `:export-md` | Full |
| Add Tags | `Ctrl+K` → "Tag Document" | `:tag [tags]` | Full |
| Git Sync | `Ctrl+K` → "Git Sync" | `:sync` | Full |
| Switch Project | `Ctrl+K` → "Switch to..." | `:switch @alias` | Full |
| Bulk Operations | Not available | `:delete [paths]` | Partial* |

*Note: Bulk operations via path patterns are unique to command line but can be added to palette.

### Decision: Simplify Command Line

**Recommendation:** Transform the command line into a **Quick Create Input** focused solely on content creation, removing all navigation and action commands.

See [[adr-003-command-line-fate]] for the complete decision record.

#### Proposed Simplification

**Keep:**
- Text input for quick document/entry creation
- Project context indicator (`@project >`)
- `Enter` to submit

**Remove:**
- All `:command` syntax
- Navigation commands (use palette)
- Action commands (use palette)
- `:help` (use `?` for help modal)

**New Behavior:**
1. User types plain text
2. `Enter` creates a new document with that title
3. `Shift+Enter` creates a journal entry with that content
4. No colon-prefixed commands

#### Wireframe: Quick Create Input

**Current:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ @work > :new Meeting Notes                                        Ctrl+D │
└──────────────────────────────────────────────────────────────────────────┘
```

**Proposed:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ @work > Meeting Notes                          Enter: doc  Shift+Enter: journal │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Migration Path

| Phase | Change | User Impact |
|-------|--------|-------------|
| 1 | Show deprecation notice for `:commands` | Warning only |
| 2 | `:command` still works but suggests palette | Gentle nudge |
| 3 | Remove `:command` parsing, plain text only | Full transition |
| 4 | Rename component to `QuickCreateInput` | Clarify purpose |

---

## Integration with Command Palette

### Palette as Navigation Hub

The command palette centralizes all navigation previously scattered across:
- Sidebar links
- Command line commands
- Keyboard shortcuts
- Direct URL navigation

### Recommended Palette Enhancements

To fully replace command line, add these commands:

| Command | Current Source | Palette Command |
|---------|---------------|-----------------|
| Bulk tag | `:tag` on selection | "Tag Selected Documents" |
| Bulk archive | `:archive [paths]` | "Archive Selected Documents" |
| Bulk delete | `:delete [paths]` | "Delete Selected Documents" |
| Show tags | `:tags` | "Show Document Tags" (inspector panel) |

### Context-Aware Defaults

When the palette opens, pre-populate based on context:

| Context | Default Filter | Reason |
|---------|---------------|--------|
| Dashboard with selection | Show "Selected:" commands | Bulk operations |
| Document view | Show "Document:" commands | Current doc actions |
| Journal view | Show "Journal:" commands | Journal actions |
| Settings | Show "Settings:" commands | Configuration |

---

## Accessibility Considerations

### Screen Reader Support

| Element | Announcement |
|---------|--------------|
| Recent Documents sub-palette | "Recent Documents, 6 items. Press arrow keys to navigate." |
| Favorite toggle | "Added to favorites" / "Removed from favorites" |
| Quick Create input | "Quick create input. Type title and press Enter to create document." |

### Keyboard Navigation

| Context | Keys | Action |
|---------|------|--------|
| Recent sub-palette | `↑↓` | Navigate list |
| Recent sub-palette | `Enter` | Open document |
| Recent sub-palette | `Esc` | Close sub-palette |
| Quick Create | `Enter` | Create document |
| Quick Create | `Shift+Enter` | Create journal entry |
| Quick Create | `Esc` | Blur and clear input |

### Focus Management

- Sub-palette traps focus while open
- Escape returns focus to previous element
- Quick Create input is focusable via `Ctrl+D` (mnemonic: document)

---

## Implementation Checklist

### Phase 1: Recent Documents

- [ ] Create `RecentDocumentsState` in localStorage
- [ ] Add `recordDocumentAccess()` calls to document navigation
- [ ] Create Recent Documents sub-palette component
- [ ] Add `Ctrl+E` keyboard shortcut
- [ ] Add "Recent Documents" to command palette
- [ ] Implement fuzzy filter within sub-palette

### Phase 2: Command Line Simplification

- [ ] Add deprecation warnings for `:command` syntax
- [ ] Create `QuickCreateInput` component
- [ ] Implement plain text → document creation
- [ ] Implement `Shift+Enter` → journal entry creation
- [ ] Update placeholder text to explain behavior
- [ ] Add hint badges for `Enter` and `Shift+Enter`

### Phase 3: Palette Enhancements

- [ ] Add "Tag Selected Documents" command
- [ ] Add "Archive Selected Documents" command
- [ ] Add "Delete Selected Documents" command
- [ ] Implement context-aware default filtering
- [ ] Add selection count to status bar

### Phase 4: Favorites (Future)

- [ ] Create `FavoritesState` in localStorage
- [ ] Add "Add to Favorites" command
- [ ] Create Favorites section in palette
- [ ] Implement favorite toggle shortcut
- [ ] Add sync to backend settings (optional)

---

## Success Metrics

### Adoption Indicators

| Metric | Target | Measurement |
|--------|--------|-------------|
| Command palette usage | 80%+ of navigation | Analytics: palette opens per session |
| Recent Documents usage | 50%+ of returns | Analytics: `Ctrl+E` frequency |
| Command line deprecation | <5% using `:commands` | Analytics: colon prefix detection |

### User Feedback Signals

- Reduced "how do I..." support requests
- Increased keyboard shortcut adoption (tracked via usage)
- Positive feedback on Quick Create simplicity

---

## Related Documentation

- [[mental-model]] - Core concepts and navigation patterns
- [[command-palette-design]] - Primary navigation interface specifications
- [[discoverability/shortcuts]] - Keyboard shortcut visibility strategy
- [[sidebar-toggle]] - Sidebar-off-by-default design
- [[adr-001-command-palette-first]] - Decision: palette as primary navigation
- [[adr-003-command-line-fate]] - Decision: command line simplification
