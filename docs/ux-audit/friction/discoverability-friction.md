---
type: analysis
title: Discoverability Friction Points
created: 2026-02-01
tags:
  - ux-audit
  - friction
  - discoverability
related:
  - "[[command-palette-audit]]"
  - "[[command-line-audit]]"
  - "[[keyboard-shortcuts]]"
  - "[[navigation-friction]]"
---

# Discoverability Friction Points

This document identifies and analyzes friction points related to users finding and learning about features, commands, and capabilities in YANTA.

## Summary

Discoverability friction occurs when users are unaware of available features or cannot easily learn how to use them. This includes hidden functionality, unclear affordances, missing documentation, and inconsistent help systems.

---

## Friction Point 1: Command Palette Hints Show Descriptions, Not Shortcuts

**Description:** The command palette displays descriptive hints (e.g., "Create new entry") instead of keyboard shortcuts (e.g., "Ctrl+N"). Users cannot discover shortcuts through normal palette use.

**Severity:** High

**Affected User Journeys:**
- All journeys (keyboard efficiency discovery)

**Current Behavior:**
```
┌────────────────────────────────────────────────┐
│ Type a command...                              │
├────────────────────────────────────────────────┤
│ 📄 New Document          Create new entry      │  ← Hint is description
│ 📁 Go to Dashboard       Home                  │
│ 🔍 Go to Search          Find documents        │
└────────────────────────────────────────────────┘
```

**Expected by Users:**
```
┌────────────────────────────────────────────────┐
│ Type a command...                              │
├────────────────────────────────────────────────┤
│ 📄 New Document                      Ctrl+N    │  ← Shortcut shown
│ 📁 Go to Dashboard                             │
│ 🔍 Go to Search                      Ctrl+F    │
└────────────────────────────────────────────────┘
```

**Impact:**
- Users never learn keyboard shortcuts from palette use
- Must discover shortcuts via help modal or documentation
- Reduces transition to keyboard-first workflow

**Evidence:** [[command-palette-audit#Keyboard Shortcut Discoverability Analysis]] identifies this as a critical gap.

---

## Friction Point 2: Command Palette Activation Not Indicated in UI

**Description:** There is no visual indicator in the application chrome showing that `Ctrl+K` opens the command palette. Users discover it by accident or from documentation.

**Severity:** High

**Affected User Journeys:**
- All journeys (new user onboarding)

**Current State:**
- Header shows: Logo | Toggle Sidebar
- No `⌘K` badge anywhere
- No keyboard hints in empty states

**Missing:**
- Keyboard shortcut badge in header/footer
- First-run tooltip pointing to palette
- "Press Ctrl+K for commands" hint anywhere

**Impact:**
- New users don't know command palette exists
- Core navigation feature is hidden
- Forces reliance on mouse navigation

---

## Friction Point 3: Help Shortcut (`Shift+?`) Not Discoverable

**Description:** The help modal exists and is comprehensive, but users have no way to know `Shift+?` opens it without prior documentation.

**Severity:** Medium

**Affected User Journeys:**
- All journeys (help access)

**Current State:**
- No "Help" menu item
- No `?` icon in interface
- No "Press ? for help" hint

**Missing:**
- Help icon/link in sidebar or header
- Command palette entry for "Show Help"
- Footer hint showing help shortcut

**Impact:**
- Users cannot find help when confused
- Comprehensive shortcut documentation goes unused
- Support burden increases

**Evidence:** [[command-palette-audit]] shows "Open Help" command is missing from palette.

---

## Friction Point 4: Command Line Placeholder Lies About Help

**Description:** The command line placeholder says "type command or press / for help" but pressing `/` does not show help. This is actively misleading.

**Severity:** High

**Affected User Journeys:**
- [[user-journeys#Journey 1: Create a New Document]]
- Any command line interaction

**Current Behavior:**
```
@project > type command or press / for help
           ↓
User presses /
           ↓
Nothing happens (or "/" is typed)
```

**Expected Behavior:**
- `/` should focus help modal or show command reference
- Or placeholder should be accurate about available help

**Impact:**
- Active user frustration when help doesn't work
- Damages trust in UI guidance
- Users give up on learning CLI commands

**Evidence:** [[command-line-audit#Friction Point 5]] identifies this as the most actionable issue.

---

## Friction Point 5: Context-Specific Commands Not Surfaced

**Description:** Available commands change based on page context, but users have no way to know which commands are available on the current page without trial and error.

**Severity:** Medium

**Affected User Journeys:**
- All journeys using command line

**Current State:**
| Page | Command Line Available | Available Commands |
|------|------------------------|-------------------|
| Dashboard | Yes | new, doc, archive, delete, export |
| Document | Yes | tag, untag, tags, export |
| Projects | Yes | new, archive, rename, delete |
| Journal | No | (no command line) |
| Search | No | (no command line) |
| Settings | No | (no command line) |

**Users Don't Know:**
- Which pages have command line
- What commands work on which page
- That commands differ by context

**Impact:**
- Users try commands that don't exist
- Successful commands become accidental discoveries
- No progressive learning path

---

## Friction Point 6: Keyboard Shortcuts Not Shown in Context

**Description:** Page-specific shortcuts are not displayed within the interface where they apply. Users must open help modal or guess.

**Severity:** Medium

**Affected User Journeys:**
- [[user-journeys#Journey 5: Navigate from Dashboard to Journal]]
- All list navigation

**Current State:**
- Dashboard shows document list but no hint about `j/k` navigation
- Journal shows entries but no hint about `Space` to select
- Empty states don't suggest keyboard actions

**Missing:**
- Subtle footer showing "j/k to navigate, Space to select, Enter to open"
- Tooltips on interactive elements showing shortcuts
- First-use hints

**Impact:**
- Users use mouse when keyboard would be faster
- vi-style navigation goes unused
- App feels less keyboard-friendly than it is

---

## Friction Point 7: Quick Capture Destination Not Indicated

**Description:** After using Quick Capture, users don't know where their note went. No feedback indicates content was saved to Journal.

**Severity:** Medium

**Affected User Journeys:**
- [[user-journeys#Journey 2: Quick Capture a Note to Journal]]

**Current Behavior:**
```
Quick Capture → Type note → Ctrl+Enter
                              ↓
                    Window closes silently
                              ↓
                    User checks Dashboard (not there)
                              ↓
                    Confusion: "Where did it go?"
```

**Missing:**
- Success notification: "Saved to Journal"
- Link to view the entry
- Visual feedback of destination

**Impact:**
- Users think notes are lost
- Mental model confusion about Quick Capture vs Documents
- Reduced trust in capture mechanism

**Evidence:** [[documents-vs-journal#Points of Confusion]] identifies this as confusion point #1.

---

## Friction Point 8: Search Syntax Not Documented in UI

**Description:** The Search page supports advanced syntax (`project:`, `tag:`, `title:`, `body:`, `-exclude`, `"phrase"`, `AND`/`OR`) but none of this is visible in the interface.

**Severity:** Medium

**Affected User Journeys:**
- [[user-journeys#Journey 3: Search Across All Content]]

**Current State:**
- Search input with placeholder "Search documents..."
- No syntax hints
- No advanced search documentation

**Missing:**
- Dropdown showing syntax options
- "Search tips" link or modal
- Autocomplete for `project:` showing available projects

**Impact:**
- Power search features go unused
- Users think search is basic free-text only
- Repeated frustrated searches

---

## Friction Point 9: Export Capabilities Hidden

**Description:** YANTA can export documents to Markdown and PDF, and export entire projects, but these capabilities aren't prominently surfaced.

**Severity:** Low

**Affected User Journeys:**
- Data portability (not in documented journeys)

**Current Access:**
- Command palette: "Export Document" / "Export Document to PDF"
- Command line: `export-md`, `export-pdf`
- No menu items or toolbar buttons

**Missing:**
- Export button in document toolbar
- "Export" section in settings
- File menu with export options

**Impact:**
- Users don't know data is portable
- May avoid YANTA due to lock-in concerns
- Manual workarounds when export exists

---

## Friction Point 10: Git Integration Invisible to New Users

**Description:** YANTA has built-in Git sync, but new users may not realize this exists or how to use it.

**Severity:** Low

**Affected User Journeys:**
- Data synchronization

**Current State:**
- Command palette: "Git Sync", "Git Push", "Git Pull"
- Settings page has sync configuration
- No persistent sync status indicator

**Missing:**
- Sync status in header/footer
- "Sync" button in toolbar
- Onboarding explanation of sync model

**Impact:**
- Users set up external sync tools
- Data loss risk from not understanding sync
- Feature goes unused

---

## Summary Table

| ID | Friction Point | Severity | Key Impact |
|----|----------------|----------|------------|
| DF-1 | Palette hints show descriptions, not shortcuts | High | Shortcuts never learned |
| DF-2 | Palette activation not indicated | High | Core feature hidden |
| DF-3 | Help shortcut not discoverable | Medium | Help goes unused |
| DF-4 | Command line help placeholder lies | High | Active frustration |
| DF-5 | Context-specific commands not surfaced | Medium | Commands undiscovered |
| DF-6 | Shortcuts not shown in context | Medium | Mouse over keyboard |
| DF-7 | Quick Capture destination not indicated | Medium | Mental model confusion |
| DF-8 | Search syntax not documented | Medium | Power features unused |
| DF-9 | Export capabilities hidden | Low | Lock-in concerns |
| DF-10 | Git integration invisible | Low | Feature unused |

---

## Recommendations

### High Priority

1. **Show Keyboard Shortcuts in Palette Hints**
   - Replace descriptions with shortcuts where available
   - Fall back to descriptions only when no shortcut exists

2. **Add Command Palette Badge to UI**
   - Place `⌘K` badge in header or footer
   - Animate on first launch to draw attention

3. **Fix Command Line Help**
   - Either implement `/` help or change placeholder
   - Consider showing command reference on `?` or `help`

### Medium Priority

4. **Add "Show Help" to Command Palette**
   - Allows discovery of help via palette search
   - Bridges gap for users who find palette but not `?`

5. **Add Contextual Shortcut Hints**
   - Footer bar: "j↓ k↑ Space select Enter open"
   - Only show relevant shortcuts for current page

6. **Improve Quick Capture Feedback**
   - Toast notification: "Saved to Journal for @project"
   - Optional "View Entry" link in notification

7. **Add Search Syntax Documentation**
   - "Search tips" button near search input
   - Autocomplete for operators and project names

### Low Priority

8. **Add Export Button to Document View**
   - Dropdown: "Export as Markdown" / "Export as PDF"
   - Visible affordance for data portability

9. **Add Sync Status Indicator**
   - Small icon in header showing sync state
   - Click to open sync settings or trigger sync

---

## Related Documentation

- [[command-palette-audit]] - Detailed palette analysis
- [[command-line-audit]] - Command line analysis
- [[keyboard-shortcuts]] - Shortcut catalog
- [[navigation-friction]] - Navigation issues
- [[documents-vs-journal]] - Concept confusion analysis
