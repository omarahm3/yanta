---
type: analysis
title: Navigation Friction Points
created: 2026-02-01
tags:
  - ux-audit
  - friction
  - navigation
related:
  - "[[sidebar]]"
  - "[[command-palette]]"
  - "[[command-line]]"
  - "[[user-journeys]]"
  - "[[discoverability-friction]]"
---

# Navigation Friction Points

This document identifies and analyzes friction points related to moving between pages and views in YANTA.

## Summary

Navigation friction occurs when users encounter obstacles while moving between different areas of the application. This includes issues with route transitions, deep linking, context switching, and orientation within the application.

---

## Friction Point 1: No Direct Navigation to Specific Document from Anywhere

**Description:** Users cannot navigate directly to a specific document by name from any page. The command palette offers "New Document" but no "Open Document" or document search within the palette.

**Severity:** High

**Affected User Journeys:**
- [[user-journeys#Journey 3: Search Across All Content]]
- [[user-journeys#Journey 1: Create a New Document]]

**Current Workarounds:**
1. Navigate to Dashboard → scroll/search for document
2. Navigate to Search → type query → click result
3. Use command line with numeric index (requires knowing index)

**Impact:**
- Extra navigation steps to reach known documents
- Breaks keyboard-first workflow when document name is known
- Forces context switch to Dashboard or Search pages

**Evidence:** Command palette audit shows no "Open Document by Name" command exists. Users familiar with VS Code's `Ctrl+P` quick-open pattern will expect similar functionality.

---

## Friction Point 2: Dashboard Label Obscures Document Access

**Description:** The sidebar uses "dashboard" as the entry point for documents, but users think of this as their "Documents" list. The mental model mismatch creates hesitation.

**Severity:** Medium

**Affected User Journeys:**
- [[user-journeys#Journey 1: Create a New Document]]
- [[user-journeys#Journey 5: Navigate from Dashboard to Journal]]

**Current Behavior:**
```
Sidebar NAVIGATION
├── dashboard    ← Contains documents, but labeled "dashboard"
├── projects
├── search
├── journal      ← Clearly labeled for its content
└── settings
```

**Expected by Users:**
- "documents" or "files" would be more discoverable
- Or rename to "home" if dashboard is truly the hub concept

**Impact:**
- New users hunt for a "documents" link
- Mental model confusion between "dashboard" and "documents"
- Inconsistent with "journal" which is content-labeled

**Evidence:** [[documents-vs-journal]] analysis identified terminology inconsistency between UI ("dashboard") and internal code ("Document", "DocumentList").

---

## Friction Point 3: No Quick Return to Previous Location

**Description:** After opening a document or drilling into a specific context, there's no easy way to return to the previous location. Escape works contextually but behavior varies.

**Severity:** Medium

**Affected User Journeys:**
- [[user-journeys#Journey 1: Create a New Document]]
- [[user-journeys#Journey 3: Search Across All Content]]

**Current Behavior:**
| Context | Escape Behavior |
|---------|-----------------|
| Document Editor | Navigate back to Dashboard (if editor unfocused) |
| Search Results | Unfocus input only |
| Journal | Clear selection only |
| Command Palette | Close palette |
| Command Line | Clear input and blur |

**Missing:**
- Browser-like back/forward navigation
- "Recent locations" stack
- `Ctrl+Tab` to cycle recent pages

**Impact:**
- Users lose context when deep-diving into documents
- Multi-step navigation required to return to prior location
- No history traversal mechanism

---

## Friction Point 4: Search Results Navigation Requires Extra Step

**Description:** After finding content via Search, users must click a result to navigate. There's no preview pane or inline expansion. Each result requires a full page navigation.

**Severity:** Medium

**Affected User Journeys:**
- [[user-journeys#Journey 3: Search Across All Content]]

**Current Flow:**
```
Search → Type query → View results list → Click result → Page loads
                                                ↓
                                    (Context lost if wrong result)
                                                ↓
                                    Navigate back to Search → Try again
```

**Missing Features:**
- Split-pane preview of selected result
- Arrow key navigation through results with preview
- Inline snippet expansion without full navigation

**Impact:**
- Hunting through results is slow
- Each wrong click costs a round-trip navigation
- Cannot compare multiple results without repeated navigation

---

## Friction Point 5: Project Context Switch Not Visible During Navigation

**Description:** When switching projects via sidebar or command palette, the success notification appears briefly, but the UI doesn't clearly indicate which project is now active until users look at the sidebar highlight.

**Severity:** Low

**Affected User Journeys:**
- [[user-journeys#Journey 4: Switch Between Projects]]

**Current Behavior:**
1. User clicks project in sidebar or selects from palette
2. Toast notification: "Switched to [Project Name]"
3. Sidebar updates highlight
4. Dashboard reloads with new project's documents

**Missing:**
- Project indicator in header/title bar (persistent)
- Color-coded page chrome matching project color
- Project name in page title

**Impact:**
- Users may not notice project switch completed
- Easy to accidentally work in wrong project
- No persistent visual confirmation of context

---

## Friction Point 6: Journal Navigation Lacks Day-Jump Feature

**Description:** The Journal uses `Ctrl+N`/`Ctrl+P` and arrow keys for day-by-day navigation, but there's no quick way to jump to a specific date or "today" from a distant date.

**Severity:** Low

**Affected User Journeys:**
- [[user-journeys#Journey 5: Navigate from Dashboard to Journal]]

**Current Navigation:**
| Method | Action |
|--------|--------|
| `Ctrl+N` or `→` | Next day |
| `Ctrl+P` or `←` | Previous day |
| Click calendar | Jump to clicked date |

**Missing:**
- "Go to today" shortcut (e.g., `t` or `Ctrl+T`)
- "Go to date" command (type `2025-12-25` to jump)
- Week/month navigation shortcuts

**Impact:**
- Tedious to navigate from old entries back to today
- No keyboard-only way to jump to arbitrary date
- Mouse required for anything beyond adjacent days

---

## Friction Point 7: Sidebar Hidden on Document Page

**Description:** When editing a document, the sidebar is hidden by default. Users must toggle it back on to navigate elsewhere, adding friction to context switching.

**Severity:** Low

**Affected User Journeys:**
- [[user-journeys#Journey 1: Create a New Document]]

**Current Behavior:**
```
Dashboard (sidebar visible) → Open Document → Sidebar hidden
                                    ↓
                          User wants to switch project
                                    ↓
                          Must press Ctrl+B to show sidebar
                                    ↓
                          Or use Ctrl+K for command palette
```

**Rationale:** Maximizing editor space is intentional design choice.

**Impact:**
- Breaks navigation muscle memory
- Extra keystroke to access sidebar navigation
- Users may not know sidebar toggle exists

---

## Friction Point 8: No Breadcrumb Trail

**Description:** The application provides no visual breadcrumb showing the current navigation path (e.g., "Projects > @work > Meeting Notes").

**Severity:** Low

**Affected User Journeys:**
- All journeys involving nested navigation

**Current State:** Users infer location from:
- Sidebar active state highlight
- Page title/header content
- URL (not visible in Tauri window)

**Missing:**
- Clickable breadcrumb component
- Path display in header
- "You are here" indicator

**Impact:**
- Disorientation in deep navigation states
- No quick way to navigate up hierarchy
- Users must rebuild mental map of location

---

## Summary Table

| ID | Friction Point | Severity | Key Impact |
|----|----------------|----------|------------|
| NF-1 | No direct document navigation | High | Extra steps to reach known docs |
| NF-2 | Dashboard label obscures documents | Medium | Mental model mismatch |
| NF-3 | No quick return to previous location | Medium | Lost context on deep dives |
| NF-4 | Search results require full navigation | Medium | Slow result hunting |
| NF-5 | Project context switch not visible | Low | Accidental wrong-project work |
| NF-6 | Journal lacks day-jump feature | Low | Tedious date navigation |
| NF-7 | Sidebar hidden on document page | Low | Extra keystroke for navigation |
| NF-8 | No breadcrumb trail | Low | Disorientation in deep states |

---

## Recommendations

### High Priority

1. **Add "Open Document" to Command Palette**
   - Fuzzy search documents by title within palette
   - Show project badge on results
   - Direct navigation without leaving current context

2. **Rename "dashboard" to "documents" in Sidebar**
   - Align UI terminology with user mental model
   - Keep internal code naming unchanged

### Medium Priority

3. **Implement Navigation History**
   - Track visited pages in stack
   - `Alt+←` / `Alt+→` for back/forward
   - Recent pages dropdown

4. **Add Search Result Preview**
   - Split pane or inline expansion
   - Arrow key navigation with preview update

### Low Priority

5. **Add "Go to Today" Shortcut in Journal**
   - `t` key to jump to today
   - Command palette "Journal: Today"

6. **Persist Sidebar State by Page Type**
   - Remember user's preference per page
   - Or add "compact mode" setting

7. **Add Persistent Project Indicator**
   - Project name/color in header
   - Always visible, not just in sidebar

---

## Related Documentation

- [[sidebar]] - Sidebar navigation structure
- [[command-palette]] - Command palette commands
- [[user-journeys]] - User flow documentation
- [[discoverability-friction]] - Feature discovery issues
