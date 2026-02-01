---
type: analysis
title: User Journey Mapping
created: 2026-02-01
tags:
  - ux-audit
  - user-journey
related:
  - "[[sidebar]]"
  - "[[command-palette]]"
  - "[[command-line]]"
  - "[[keyboard-shortcuts]]"
---

# User Journey Mapping

This document maps the common user journeys in YANTA, documenting the steps, navigation changes, and entry points for each workflow.

## Journey 1: Create a New Document

**Goal:** User wants to create and save a new document in their current project.

### Entry Points

| Method | Access | Context Required |
|--------|--------|------------------|
| Keyboard shortcut | `Mod+N` | Must be on Dashboard page |
| Command Palette | `Mod+K` → "New Document" | Works from any page |
| Dashboard command line | `:new [title]` | Must be on Dashboard page |

### Flow Diagram

```
                    ┌─────────────────────────────────────────┐
                    │           USER WANTS TO CREATE          │
                    │            A NEW DOCUMENT               │
                    └─────────────────┬───────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
   ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
   │   Mod+N on   │          │  Mod+K then  │          │  :new [text] │
   │  Dashboard   │          │"New Document"│          │ command line │
   └──────┬───────┘          └──────┬───────┘          └──────┬───────┘
          │                         │                         │
          └────────────────────────►├◄────────────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  Document Editor     │
                         │  Opens (new doc)     │
                         │  - Title focused     │
                         │  - Empty content     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  User types title    │
                         │  and content         │
                         │  - Rich text editor  │
                         │  - #tags inline      │
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
       ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
       │  Auto-save  │      │   Mod+S     │      │   Escape    │
       │ (every 2s)  │      │   Manual    │      │  (go back)  │
       └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
              │                    │                    │
              └────────────────────┴────────────────────┘
                                   │
                                   ▼
                         ┌──────────────────────┐
                         │  Document saved to   │
                         │  current project     │
                         │  (appears in list)   │
                         └──────────────────────┘
```

### Steps Breakdown

1. **Initiate Creation**
   - From Dashboard: Press `Mod+N`
   - From anywhere: Press `Mod+K`, type "new", select "New Document"
   - From Dashboard command line: Type `:new My Document Title`

2. **Editor Opens**
   - Navigation changes to Document page
   - Title field is auto-focused
   - Editor initialized with BlockNote rich text editor
   - Command line available at bottom

3. **Content Entry**
   - Type document title
   - Tab or click to move to body
   - Use markdown or rich text formatting
   - Inline tags with `#tagname` syntax

4. **Save & Exit**
   - Auto-save triggers every 2 seconds while editing
   - `Mod+S` for manual save
   - Press `Escape` to return to Dashboard

### Navigation State Changes

| State | Before | After |
|-------|--------|-------|
| Current Page | Dashboard/Any | Document |
| URL State | - | `documentPath` set |
| Sidebar | Shows projects | Hidden on Document page |
| Command Line | Dashboard context | Document context |

### Inputs Required

- **Project**: Current project (implicit, from context)
- **Title**: Document title (optional, can be blank initially)
- **Content**: Document body (optional)
- **Tags**: Via `#tag` syntax or `:tag` command

---

## Journey 2: Quick Capture a Note to Journal

**Goal:** User wants to rapidly capture a thought or note without leaving their current workflow.

### Entry Points

| Method | Access | Context Required |
|--------|--------|------------------|
| Global hotkey | User-configured system shortcut | None (works anywhere) |
| System tray | Right-click → Quick Capture | Application running |

### Flow Diagram

```
                    ┌─────────────────────────────────────────┐
                    │        USER HAS QUICK THOUGHT           │
                    │         TO CAPTURE                      │
                    └─────────────────┬───────────────────────┘
                                      │
                                      ▼
                         ┌──────────────────────┐
                         │  Press global hotkey │
                         │  (user-configured)   │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  Quick Capture       │
                         │  window appears      │
                         │  - Floating panel    │
                         │  - Always on top     │
                         │  - Text area focused │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  User types note     │
                         │  - Plain text        │
                         │  - #tags inline      │
                         │  - @project to set   │
                         │    target project    │
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
       ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
       │ Ctrl+Enter  │      │Shift+Enter  │      │   Escape    │
       │ Save+Close  │      │Save+Stay    │      │  (discard)  │
       └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
              │                    │                    │
              │                    ▼                    │
              │            ┌─────────────┐             │
              │            │ Window stays│             │
              │            │ open, text  │             │
              │            │ cleared for │             │
              │            │ next entry  │             │
              │            └──────┬──────┘             │
              │                   │                    │
              │                   ▼                    │
              │            ┌─────────────┐             │
              │            │ User types  │             │
              │            │ another note│             │
              │            └──────┬──────┘             │
              │                   │                    │
              ▼                   ▼                    ▼
       ┌──────────────────────────────────────────────────────┐
       │                Note saved to Journal                  │
       │      - Tagged with extracted #hashtags                │
       │      - Saved to @project (or last used project)       │
       │      - Timestamped with current date                  │
       └──────────────────────────────────────────────────────┘
```

### Steps Breakdown

1. **Activate Quick Capture**
   - Press user-configured global hotkey
   - Floating window appears over current application
   - Text area is immediately focused

2. **Compose Note**
   - Type note content freely
   - Use `#tagname` for inline tags (extracted automatically)
   - Use `@projectalias` to specify target project
   - Tags appear as removable chips below text area

3. **Project Selection**
   - Default: last used project (stored in localStorage)
   - Override: type `@projectalias` anywhere in text
   - Visual indicator shows selected project

4. **Save Options**
   - `Ctrl+Enter`: Save and close window
   - `Shift+Enter`: Save and keep window open for batch capture
   - First `Escape`: Shows "Press Esc again to discard" hint
   - Second `Escape`: Discards and closes

### Where Content Ends Up

| Component | Location |
|-----------|----------|
| Content | Journal entry (with tags/project stripped from text) |
| Tags | Entry metadata, searchable |
| Date | Today's date |
| Project | Selected project or last used |
| Type | Journal Note (not Document) |

### Parsing Rules

```
Input: "Remember to buy milk #todo #shopping @personal"

Parsed:
- Content: "Remember to buy milk"
- Tags: ["todo", "shopping"]
- Project: "personal"
```

---

## Journey 3: Search Across All Content

**Goal:** User wants to find documents or notes matching specific criteria.

### Entry Points

| Method | Access | Context Required |
|--------|--------|------------------|
| Sidebar | Click "search" in NAVIGATION | Any page |
| Command Palette | `Mod+K` → "Go to Search" | Any page |
| Keyboard | `/` (when on Search page) | Search page |

### Flow Diagram

```
                    ┌─────────────────────────────────────────┐
                    │      USER WANTS TO FIND SOMETHING       │
                    └─────────────────┬───────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────┐
          │                           │                       │
          ▼                           ▼                       │
   ┌──────────────┐          ┌──────────────┐                │
   │   Sidebar    │          │   Mod+K →    │                │
   │  "search"    │          │ "Go to Search"│               │
   └──────┬───────┘          └──────┬───────┘                │
          │                         │                        │
          └────────────────────────►│◄───────────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  Search Page loads   │
                         │  - Input focused     │
                         │  - Tags listed       │
                         │  - Projects listed   │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  User types query    │
                         │  (300ms debounce)    │
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────────┐
              │                     │                         │
              ▼                     ▼                         ▼
       ┌─────────────┐      ┌─────────────┐          ┌─────────────┐
       │ Free text   │      │ Advanced    │          │ Click tag/  │
       │  "meeting"  │      │ syntax:     │          │ project     │
       │             │      │ project:    │          │ filter      │
       │             │      │ tag: title: │          │ button      │
       └──────┬──────┘      └──────┬──────┘          └──────┬──────┘
              │                    │                        │
              └────────────────────┼────────────────────────┘
                                   │
                                   ▼
                         ┌──────────────────────┐
                         │  Results displayed   │
                         │  - Type badge        │
                         │  - Project badge     │
                         │  - Match snippets    │
                         │  - Match count       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  Navigate results    │
                         │  Tab → first result  │
                         │  j/k → up/down       │
                         │  Enter → open        │
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              │                                           │
              ▼                                           ▼
       ┌─────────────┐                           ┌─────────────┐
       │  Document   │                           │   Journal   │
       │  opens in   │                           │  opens at   │
       │  editor     │                           │  entry date │
       └─────────────┘                           └─────────────┘
```

### Steps Breakdown

1. **Access Search**
   - Navigate via sidebar "search" link
   - Or use `Mod+K` → "Go to Search"
   - Search input is auto-focused

2. **Compose Query**
   - Free text: `meeting notes`
   - Project filter: `project:work`
   - Tag filter: `tag:important`
   - Title only: `title:quarterly`
   - Body only: `body:revenue`
   - Exclude: `-draft`
   - Exact phrase: `"Q4 review"`
   - Logical: `meeting AND notes OR summary`

3. **View Results**
   - Results appear after 300ms debounce
   - Each result shows:
     - Type badge (Document/Note)
     - Project alias with color
     - Last modified date
     - Match count
     - Highlighted snippets

4. **Navigate Results**
   - `Tab` from input → first result
   - `j` / `k` → navigate down/up
   - `Enter` → open selected
   - `/` → refocus input (selects all)
   - `Escape` → unfocus

5. **Open Result**
   - Document → opens in Document editor
   - Journal note → opens Journal at that date
   - Project context switches automatically

### Result Types

| Type | Badge | Opens To |
|------|-------|----------|
| Document | "Document" | Document page with `documentPath` |
| Journal Entry | "Note" | Journal page with `date` set |

### Search Syntax Reference

| Syntax | Purpose | Example |
|--------|---------|---------|
| Free text | Matches anywhere | `meeting` |
| `project:` | Filter by project | `project:work` |
| `tag:` | Filter by tag | `tag:important` |
| `title:` | Search title only | `title:quarterly` |
| `body:` | Search body only | `body:revenue` |
| `-term` | Exclude term | `-draft` |
| `"phrase"` | Exact phrase | `"Q4 review"` |
| `AND` `OR` | Logical operators | `budget AND 2024` |

---

## Journey 4: Switch Between Projects

**Goal:** User wants to change the active project context to view different documents.

### Entry Points

| Method | Access | Speed |
|--------|--------|-------|
| Sidebar | Click project name in PROJECTS section | Fast |
| Command Palette | `Mod+K` → "Switch to {Project}" | Fastest |
| Projects page | Double-click or Enter on project row | Moderate |
| Command line | `:switch @projectalias` | Moderate |

### Flow Diagram

```
                    ┌─────────────────────────────────────────┐
                    │    USER WANTS TO SWITCH PROJECTS        │
                    └─────────────────┬───────────────────────┘
                                      │
     ┌────────────────────────────────┼────────────────────────────────┐
     │                    │           │           │                    │
     ▼                    ▼           ▼           ▼                    ▼
┌──────────┐      ┌──────────┐ ┌──────────┐ ┌──────────┐      ┌──────────┐
│ Sidebar  │      │  Mod+K   │ │ Projects │ │ Projects │      │ Projects │
│  click   │      │"Switch to│ │  page    │ │ page j/k │      │ command  │
│ project  │      │ {name}"  │ │ dbl-click│ │ + Enter  │      │   line   │
└────┬─────┘      └────┬─────┘ └────┬─────┘ └────┬─────┘      └────┬─────┘
     │                 │            │            │                 │
     └─────────────────┴────────────┴────────────┴─────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  Project context     │
                         │  switches            │
                         │  - ProjectContext    │
                         │    updated           │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  Success notification│
                         │  "Switched to        │
                         │   [Project Name]"    │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  UI updates:         │
                         │  - Dashboard shows   │
                         │    new project docs  │
                         │  - Sidebar highlights│
                         │    current project   │
                         │  - Journal shows new │
                         │    project entries   │
                         └──────────────────────┘
```

### Steps Breakdown

1. **Method A: Sidebar (Quickest Visual)**
   - Locate PROJECTS section in sidebar
   - Click desired project name
   - Immediate switch with notification

2. **Method B: Command Palette (Quickest Keyboard)**
   - Press `Mod+K`
   - Start typing project name
   - Select "Switch to {ProjectName}"
   - Palette closes, project switched

3. **Method C: Projects Page (Full Management)**
   - Navigate to Projects page (sidebar or `Mod+K`)
   - Use `j`/`k` to navigate list
   - Press `Enter` to switch
   - Or double-click project row

4. **Method D: Command Line**
   - From Projects page command line
   - Type `:switch @projectalias`
   - Press Enter

### What Changes After Switch

| Component | Behavior |
|-----------|----------|
| ProjectContext | Updates `currentProject` |
| Dashboard | Reloads document list for new project |
| Journal | Shows entries for new project |
| Sidebar | Highlights current project |
| Quick Capture | Default project updated |
| Search | Results include project badge |

### Project States

| State | Visibility |
|-------|------------|
| Active | Shown in main PROJECTS section |
| Archived | Shown in ARCHIVE section |
| Current | Highlighted with `status: "current"` |

---

## Journey 5: Navigate from Dashboard to Journal

**Goal:** User on Dashboard wants to view their Journal entries.

### Entry Points

| Method | Access | Steps |
|--------|--------|-------|
| Sidebar | Click "journal" | 1 click |
| Command Palette | `Mod+K` → "Go to Journal" | 2 steps |
| Search results | Click Journal entry result | From search |

### Flow Diagram

```
                    ┌─────────────────────────────────────────┐
                    │        USER ON DASHBOARD                │
                    │     WANTS TO VIEW JOURNAL               │
                    └─────────────────┬───────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────┐
          │                           │                       │
          ▼                           ▼                       ▼
   ┌──────────────┐          ┌──────────────┐        ┌──────────────┐
   │   Sidebar    │          │   Mod+K →    │        │   Search →   │
   │  "journal"   │          │"Go to Journal"│       │ click Note   │
   └──────┬───────┘          └──────┬───────┘        └──────┬───────┘
          │                         │                       │
          │                         │                       │
          └────────────────────────►│◄──────────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  Journal Page loads  │
                         │  - Today's date      │
                         │  - Current project   │
                         │    entries           │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  Date Picker visible │
                         │  - Dates with entries│
                         │    highlighted       │
                         │  - Today selected    │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  Entry List shows    │
                         │  - All entries for   │
                         │    selected date     │
                         │  - Ordered by time   │
                         └──────────────────────┘
```

### Steps Breakdown

1. **Via Sidebar (Simplest)**
   - Locate NAVIGATION section at top of sidebar
   - Click "journal" item
   - Journal page loads with today's entries

2. **Via Command Palette**
   - Press `Mod+K`
   - Type "journal"
   - Select "Go to Journal"
   - Page loads for current project, today

3. **Via Search Results**
   - Perform search that returns Journal entries
   - Results show "Note" badge
   - Click entry to open
   - Journal opens at entry's date with entry visible

### Mental Model Clarity

**What User Expects:**
- Journal shows daily notes/quick captures
- Organized by date, newest first
- Filtered by current project

**What User Sees:**
- Date picker with entry indicators
- List of entries for selected date
- Clear project context in header

### Journal Page Structure

```
┌─────────────────────────────────────────────────────┐
│  Journal                           @currentproject  │
├─────────────────────────────────────────────────────┤
│  ◄ Ctrl+P         [Date Picker]         Ctrl+N ►    │
│                                                     │
│  Jan | Feb | Mar | Apr | May | Jun | Jul | Aug...   │
│  ────────────────────────────────────────────────   │
│   1   2   3   4●  5   6   7●  8   9   10  11●...   │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Entries for January 7, 2026                        │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 10:30 AM                          #meeting   │   │
│  │ Discussed Q1 roadmap with team              │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 2:15 PM                           #idea      │   │
│  │ New feature concept for quick capture       │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Navigation Within Journal

| Action | Shortcut | Result |
|--------|----------|--------|
| Next day | `Ctrl+N` or `→` | Calendar advances |
| Previous day | `Ctrl+P` or `←` | Calendar goes back |
| Navigate entries | `j` / `k` | Highlight moves |
| Select entry | `Space` | Toggle selection |
| Promote to doc | `Mod+Shift+P` | Create document |
| Delete | `Mod+D` | Remove (with confirm) |

---

## Summary: Journey Comparison

| Journey | Primary Path | Steps | Key Shortcut |
|---------|-------------|-------|--------------|
| Create Document | Dashboard → `Mod+N` | 3 | `Mod+N` |
| Quick Capture | Global hotkey → type → save | 3 | Custom |
| Search | Sidebar → type → navigate | 4 | `Mod+K` |
| Switch Project | `Mod+K` → select | 2 | `Mod+K` |
| Dashboard to Journal | Sidebar → "journal" | 1 | - |

## Navigation Pattern Analysis

### Consistent Patterns

1. **Vi-style navigation** (`j`/`k`) across all list views
2. **`Mod+K`** universally opens command palette
3. **`Escape`** consistently exits/closes/goes back
4. **`Enter`** confirms selection across contexts
5. **`Space`** toggles selection in multi-select views

### Mental Model Alignment

| Component | User Mental Model | Actual Behavior | Alignment |
|-----------|------------------|-----------------|-----------|
| Documents | Long-form content | Rich editor, auto-save | Good |
| Journal | Quick notes | Date-organized, tags | Good |
| Quick Capture | Fleeting thoughts | Separate window, fast | Good |
| Search | Find anything | Unified results | Good |
| Projects | Workspaces | Context isolation | Good |
