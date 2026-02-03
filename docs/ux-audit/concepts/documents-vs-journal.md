---
type: analysis
title: Documents vs Journal Distinction
created: 2026-02-01
tags:
  - ux-audit
  - concepts
related:
  - "[[sidebar]]"
  - "[[command-palette]]"
  - "[[keyboard-shortcuts]]"
  - "[[user-journeys]]"
---

# Documents vs Journal: Concept Analysis

This document analyzes the distinction between Documents and Journal features in YANTA, documenting their navigation paths, visual differences, behavioral patterns, and identifying areas of confusion.

## Overview

YANTA implements two distinct content management paradigms:

| Aspect | Documents | Journal |
|--------|-----------|---------|
| **Purpose** | Persistent, structured knowledge artifacts | Ephemeral quick capture and daily notes |
| **Metaphor** | Traditional document editing | Daily diary/log entries |
| **Content Type** | Rich text (BlockNote blocks) | Plain text (max 10,000 characters) |
| **Organization** | Individual files by project | Date-based files (YYYY-MM-DD.json) |

---

## Navigation Paths

### Accessing Documents

Documents can be reached through multiple navigation paths:

#### 1. Sidebar Navigation
```
Sidebar → NAVIGATION section → "dashboard"
```
- Navigates to Dashboard page showing DocumentList
- Lists all active documents for the current project

#### 2. Command Palette
```
Cmd+K → "New Document"
```
- Creates a blank document
- Immediately enters document editing mode
- File: `GlobalCommandPalette.tsx` lines 132-140

#### 3. Dashboard Document List
```
Dashboard → Click document row → Document editor
```
- Each document row is clickable
- Opens document in full editing view

#### 4. Search Results
```
Search Page → Click document result → Document editor
```
- Full-text search includes document content
- Results link directly to documents

#### 5. Keyboard Shortcut (from Dashboard)
```
Dashboard → Arrow keys to select → Enter to open
```
- Navigate document list with keyboard
- Enter opens selected document

### Accessing Journal

Journal can be reached through these paths:

#### 1. Sidebar Navigation
```
Sidebar → NAVIGATION section → "journal"
```
- Navigates to Journal page with date picker
- Shows entries for selected date

#### 2. Command Palette
```
Cmd+K → "Go to Journal"
```
- Navigates directly to Journal page
- File: `GlobalCommandPalette.tsx` lines 109-118

#### 3. Quick Capture (Primary Entry Point)
```
Global Hotkey → Quick Capture window → Type entry → Ctrl+Enter
```
- Floating window (separate from main app)
- Entry saved to Journal automatically
- Does NOT navigate to Journal page

#### 4. Search Results
```
Search Page → Click journal entry result → Journal page (date)
```
- Navigates to Journal with date context

### Navigation Comparison Table

| Path Type | Documents | Journal |
|-----------|-----------|---------|
| Sidebar menu item | `dashboard` | `journal` |
| Command palette | "New Document" | "Go to Journal" |
| Direct creation | Opens editor immediately | Via Quick Capture window |
| Default view | List of all documents | Entries for today's date |
| Deep linking | `/document?path=...` | `/journal?date=YYYY-MM-DD` |

---

## Visual Differences

### Document Editor Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]                                    [Toggle Sidebar] │
├──────────┬──────────────────────────────────────────────────┤
│ SIDEBAR  │                                                  │
│          │   ┌─────────────────────────────────────────┐    │
│ Dashboard│   │ Title Input Field                       │    │
│ Projects │   └─────────────────────────────────────────┘    │
│ Search   │                                                  │
│ Journal  │   ┌─────────────────────────────────────────┐    │
│ Settings │   │                                         │    │
│          │   │     BlockNote Rich Text Editor          │    │
│ ──────── │   │                                         │    │
│ PROJECTS │   │  - Headings, lists, code blocks        │    │
│ @personal│   │  - Images, links, formatting           │    │
│ @work    │   │  - Slash command menu                  │    │
│          │   │                                         │    │
├──────────┤   └─────────────────────────────────────────┘    │
│ [Archive]│                                                  │
│          │   ┌─────────────────────────────────────────┐    │
│          │   │ :command  │ Command Line Input          │    │
│          │   └─────────────────────────────────────────┘    │
└──────────┴──────────────────────────────────────────────────┘
```

**Key Visual Elements:**
- Full-height rich text editor (BlockNote)
- Title input at top
- Command line at bottom for tag operations
- Auto-save indicator
- No date context visible

### Journal Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]                                    [Toggle Sidebar] │
├──────────┬──────────────────────────────────────────────────┤
│ SIDEBAR  │  ┌────────────────────────────────────────────┐  │
│          │  │ [< Prev]  January 2026  [Next >]          │  │
│ Dashboard│  │                                            │  │
│ Projects │  │   S   M   T   W   T   F   S               │  │
│ Search   │  │       1   2   3   4   5   6               │  │
│ Journal  │  │   7   8   9  10  11  12  13               │  │
│ Settings │  │  14  15  16  17  18  19  20               │  │
│          │  │  21  22  23  24  25 [26] 27               │  │
│ ──────── │  │  28  29  30  31                           │  │
│ PROJECTS │  └────────────────────────────────────────────┘  │
│ @personal│                                                  │
│ @work    │  ┌────────────────────────────────────────────┐  │
│          │  │ [ ] Entry content text here...            │  │
│          │  │     #tag1 #tag2         12:34 PM          │  │
│          │  ├────────────────────────────────────────────┤  │
│          │  │ [ ] Another entry for the same day...     │  │
│          │  │     #tag3               2:15 PM           │  │
│          │  └────────────────────────────────────────────┘  │
│          │                                                  │
│          │  ┌────────────────────────────────────────────┐  │
│          │  │ 2 entries │ @personal │ [Promote to Doc]  │  │
│          │  └────────────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────────────┘
```

**Key Visual Elements:**
- Calendar date picker at top
- List of entries for selected date
- Selection checkboxes for bulk operations
- Tags and timestamp on each entry
- Status bar with entry count and "Promote to Doc" action
- No rich text formatting displayed

### Quick Capture Window Layout

```
┌─────────────────────────────────────────────────────┐
│           Quick Capture                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Type your note here... #tags work @project too    │
│                                                     │
│  Syntax highlighting:                               │
│  - #tag appears green                               │
│  - @project appears blue                            │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Project: [@personal ▾]              [8,234 chars]  │
├─────────────────────────────────────────────────────┤
│ Ctrl+Enter: Save & Close  │  Shift+Enter: Save     │
│ Escape: Discard           │  Tab: Switch focus     │
└─────────────────────────────────────────────────────┘
```

**Key Visual Elements:**
- Minimal, floating window (overlay)
- Plain textarea (no rich formatting)
- Real-time syntax highlighting for #tags and @projects
- Project dropdown selector
- Character counter (appears at 8000+ chars)
- Keyboard shortcuts hint bar

### Visual Comparison Summary

| Element | Documents | Journal | Quick Capture |
|---------|-----------|---------|---------------|
| Window type | Main app page | Main app page | Floating overlay |
| Editor | BlockNote rich text | Read-only list | Plain textarea |
| Formatting | Full markdown | Plain text display | Inline syntax only |
| Date context | None visible | Calendar prominent | None (saves to today) |
| Selection | Single document | Multi-select checkboxes | N/A |
| Actions | Save, Export, Archive | Delete, Promote, Restore | Save, Discard |
| Status bar | Save state, timestamps | Entry count, bulk actions | Char count, shortcuts |

---

## Behavioral Differences

### CRUD Operations

#### Create Operations

| Operation | Documents | Journal |
|-----------|-----------|---------|
| Entry point | Cmd+K → "New Document" | Quick Capture hotkey |
| UI flow | Opens blank editor immediately | Modal appears, type, Ctrl+Enter |
| Storage | New file in `projects/@alias/doc-xxx.json` | Appends to `projects/@alias/YYYY-MM-DD.json` |
| Events emitted | `EntryCreated` | `entry/created` |

#### Read Operations

| Operation | Documents | Journal |
|-----------|-----------|---------|
| List view | Dashboard DocumentList | Journal page with date picker |
| Single item | Full editor view | List item (inline, read-only) |
| Search | Full-text via Search page | Full-text via Search page |
| Filtering | By project, tags, archived | By project, date |

#### Update Operations

| Operation | Documents | Journal |
|-----------|-----------|---------|
| Edit trigger | Open document → edit inline | Click entry → edit modal? |
| Save mechanism | Auto-save with debounce | Explicit save after edit |
| Events emitted | `EntryUpdated` | `entry/updated` (via UpdateEntry) |
| History | Full version tracking? | No version history |

#### Delete Operations

| Operation | Documents | Journal |
|-----------|-----------|---------|
| Soft delete | Archive (sets `deletedAt`) | Sets `deleted: true` flag |
| Hard delete | `HardDeleteBatch()` | Not exposed in UI |
| Restore | Archive → Restore button | Restore option in context menu |
| Bulk delete | Yes (batch operations) | Yes (Ctrl+D with multi-select) |

### Metadata Differences

#### Document Metadata

```typescript
// Full metadata tracked
interface DocumentMeta {
  title: string;
  tags: string[];
  projectAlias: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  // Computed stats
  hasCode: boolean;
  hasImages: boolean;
  hasLinks: boolean;
  wordCount: number;
  charCount: number;
}
```

#### Journal Entry Metadata

```typescript
// Minimal metadata
interface JournalEntry {
  id: string;
  content: string;      // Plain text only
  tags: string[];
  created: Date;
  deleted: boolean;
  // No: updatedAt, title, stats, relationships
}
```

### Relationship Handling

| Relationship | Documents | Journal |
|--------------|-----------|---------|
| Project assignment | Explicit via metadata | Inherited from storage path |
| Tags | Managed via command line (`:tag`, `:untag`) | Inline in content (`#tag`) |
| Cross-references | Wiki-links in BlockNote? | None |
| Promotion | N/A (already full document) | "Promote to Doc" action |

### Keyboard Shortcuts by Context

#### Document Editor Shortcuts

| Shortcut | Action |
|----------|--------|
| `Mod+S` | Save document |
| `Mod+E` | Export document |
| `Escape` | Exit editor / close |
| `Mod+B` | Toggle sidebar |
| `:command` | Enter command line mode |

#### Journal Page Shortcuts

| Shortcut | Action |
|----------|--------|
| `j` / `k` | Navigate entries up/down |
| `Space` | Toggle entry selection |
| `Ctrl+D` | Delete selected entries |
| `Ctrl+Shift+P` | Promote selected to document |
| `Escape` | Clear selection |

---

## Quick Capture Mental Model

### Where Quick Capture Fits

```
                    ┌─────────────────┐
                    │   Quick Capture │ ← Primary entry point
                    │   (Hotkey)      │    for capturing thoughts
                    └────────┬────────┘
                             │
                             │ Ctrl+Enter (save)
                             ▼
                    ┌─────────────────┐
                    │     Journal     │ ← Storage destination
                    │   (Date-based)  │    organized by date
                    └────────┬────────┘
                             │
                             │ "Promote to Doc" (optional)
                             ▼
                    ┌─────────────────┐
                    │    Documents    │ ← Permanent knowledge
                    │   (Individual)  │    with full editing
                    └─────────────────┘
```

### Quick Capture Characteristics

1. **Zero-friction entry**: Hotkey → type → Ctrl+Enter → done
2. **Always saves to Journal**: No option to create document directly
3. **Today's date implicit**: No date picker, always current date
4. **Project routing**: `@project` syntax or dropdown selection
5. **Tag extraction**: `#tag` parsed and saved as metadata
6. **Character limit**: 10,000 chars (enforced)

### Mental Model Summary

| Concept | Mental Model |
|---------|--------------|
| Quick Capture | "Jot down a thought quickly" |
| Journal | "Review and manage today's notes" |
| Documents | "Write something substantial" |
| Promotion | "This note deserves more attention" |

---

## Points of Confusion

### 1. Where Does Quick Capture Content Go?

**Issue**: Users may not realize Quick Capture saves to Journal, not Documents.

**Manifestation**:
- User captures a note via Quick Capture
- Looks in Dashboard (Documents) for it
- Cannot find it
- Confusion: "Where did my note go?"

**Current UI Gap**: No visual feedback showing "Saved to Journal" after Quick Capture.

### 2. Document vs Journal in Sidebar

**Issue**: Both appear in NAVIGATION section at same hierarchy level.

**Sidebar Structure**:
```
NAVIGATION
├── dashboard    ← Documents here
├── projects
├── search
├── journal      ← Journal here
└── settings
```

**Confusion Point**: "Dashboard" doesn't say "Documents" - the relationship isn't explicit.

### 3. Search Results Mixing

**Issue**: Search returns both Documents and Journal entries in the same results.

**Confusion Point**: User may not realize which type of content they're looking at until they click through.

### 4. Tag Behavior Differences

**Issue**: Tags work differently in each context.

| Context | Tag Input Method | Tag Display |
|---------|------------------|-------------|
| Documents | Command line (`:tag myTag`) | Metadata sidebar chips |
| Journal | Inline in content (`#myTag`) | Inline with content |
| Quick Capture | Inline syntax (`#myTag`) | Parsed and stored separately |

**Confusion Point**: Users expect consistent tag UX but encounter three different patterns.

### 5. Promotion Workflow

**Issue**: "Promote to Doc" creates a document but the workflow may be unclear.

**Questions Users May Have**:
- Is the original journal entry kept or deleted?
- Where does the new document appear?
- Can I undo promotion?
- What happens to tags during promotion?

### 6. "Dashboard" vs "Documents"

**Issue**: The word "Documents" rarely appears in the UI.

**Terminology Used**:
- Sidebar: "dashboard" (not "documents")
- Command palette: "New Document"
- Internal code: Document, DocumentList, DocumentEditor

**Confusion Point**: Inconsistent terminology between code and UI.

### 7. No Direct Document Creation from Journal

**Issue**: Cannot create a full document while in Journal context.

**Current Flow**:
```
Journal page → (no "New Document" action visible)
                → Must use Cmd+K or navigate to Dashboard
```

**Expectation**: User might expect a "New Document" button on Journal page for when an entry needs to become substantial.

### 8. Archive Behavior Asymmetry

**Issue**: Archive works differently for Documents vs Journal.

| Feature | Documents | Journal |
|---------|-----------|---------|
| Archive location | ARCHIVE section in sidebar | No separate archive |
| Visibility | Toggle "Show archived" | Deleted entries hidden |
| Restoration | Restore button in editor | Context menu option |

---

## Recommendations for Redesign

Based on this analysis, the following areas warrant attention in the UX redesign:

1. **Clarify Quick Capture destination**: Add visual feedback showing "Saved to Journal"
2. **Rename "Dashboard" to "Documents"**: Improve terminology consistency
3. **Differentiate search results**: Visual indicators for document vs journal entry
4. **Unify tag input**: Consider consistent tag UX across all contexts
5. **Streamline promotion**: Clear workflow with explicit keep/delete choice
6. **Add cross-context actions**: "New Document" accessible from Journal page
7. **Consistent archive UX**: Similar patterns for archiving both types

---

## Related Documentation

- [[sidebar]] - Sidebar navigation structure and sections
- [[command-palette]] - Command palette commands and navigation
- [[keyboard-shortcuts]] - Keyboard shortcuts by context
- [[user-journeys]] - User journey flows that traverse these concepts
