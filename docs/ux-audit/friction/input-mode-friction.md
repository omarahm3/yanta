---
type: analysis
title: Input Mode Friction Points
created: 2026-02-01
tags:
  - ux-audit
  - friction
  - input-modes
related:
  - "[[command-palette]]"
  - "[[command-line]]"
  - "[[keyboard-shortcuts]]"
  - "[[command-palette-audit]]"
  - "[[command-line-audit]]"
---

# Input Mode Friction Points

This document identifies and analyzes friction points related to switching between different input mechanisms: command palette, command line, keyboard shortcuts, and mouse interaction.

## Summary

Input mode friction occurs when users encounter difficulty switching between or choosing among the multiple input mechanisms available. YANTA offers three primary command interfaces (palette, CLI, hotkeys) plus mouse interaction, creating both power and potential confusion.

---

## Friction Point 1: Three Overlapping Command Systems

**Description:** YANTA has three distinct systems for issuing commands: command palette (`Ctrl+K`), command line (`:`), and direct keyboard shortcuts. Users must learn when to use which system.

**Severity:** High

**Affected User Journeys:**
- All journeys involving commands

**Three Systems Overview:**

| System | Activation | Strengths | Weaknesses |
|--------|-----------|-----------|------------|
| Command Palette | `Ctrl+K` | Discoverable, fuzzy search | Limited commands, no batch ops |
| Command Line | `:` | Batch ops, precise, flags | Must know syntax, no autocomplete |
| Hotkeys | Direct key press | Fastest | Must memorize, no hints |

**Overlap Example - Creating a Document:**
| Method | Input |
|--------|-------|
| Command Palette | `Ctrl+K` → "New Document" → Enter |
| Command Line | `:new My Title` → Enter |
| Hotkey | `Ctrl+N` (Dashboard only) |

**Impact:**
- Analysis paralysis: "Which way should I do this?"
- Incomplete learning of any one system
- Muscle memory conflicts

**Evidence:** [[command-line-audit#Overlap with Command Palette]] provides detailed comparison matrix.

---

## Friction Point 2: Command Line Absent on Some Pages

**Description:** The command line is available on Dashboard, Projects, and Document pages but not on Journal, Search, or Settings. This inconsistency breaks muscle memory.

**Severity:** High

**Affected User Journeys:**
- All command line workflows

**Availability Matrix:**

| Page | Command Line | Why |
|------|--------------|-----|
| Dashboard | ✅ Yes | Document operations |
| Projects | ✅ Yes | Project management |
| Document | ✅ Yes | Tag operations |
| Journal | ❌ No | Uses status bar buttons |
| Search | ❌ No | Has search input instead |
| Settings | ❌ No | Navigation-only |

**User Experience:**
```
Dashboard (:new works)
    ↓
Navigate to Journal
    ↓
Press : expecting command line
    ↓
Nothing happens (or : typed into entry if editing)
    ↓
Confusion
```

**Impact:**
- Muscle memory fails on half the pages
- Users attempt commands that don't work
- Inconsistent keyboard-first experience

---

## Friction Point 3: No Autocomplete in Command Line

**Description:** The command line requires exact command syntax but provides no autocomplete, tab completion, or suggestion dropdown.

**Severity:** Medium

**Affected User Journeys:**
- [[user-journeys#Journey 1: Create a New Document]]
- Any command line interaction

**Current Experience:**
```
@project > arc|
           ↓
User types partial command "arc"
           ↓
No suggestions appear
           ↓
User must remember: is it "archive" or "arc" or "arch"?
           ↓
Submits wrong command → error
```

**Missing Features:**
- Tab completion for command names
- Fuzzy matching suggestions
- Command history with Up/Down arrows

**Impact:**
- Must memorize exact syntax
- Frequent typing errors
- Slower than could be

**Evidence:** [[command-line-audit#Friction Point 1]] identifies this as medium severity.

---

## Friction Point 4: No Command History

**Description:** The command line doesn't remember previous commands. Users cannot press Up arrow to recall and modify recent commands.

**Severity:** Medium

**Affected User Journeys:**
- Repetitive command operations

**User Expectation:**
```
@project > delete 1 --hard
           ↓
(command executes)
           ↓
@project > |
           ↓
Press Up arrow
           ↓
@project > delete 1 --hard    ← Expected
           ↓
(nothing happens)             ← Actual
```

**Impact:**
- Must retype entire commands
- Batch operations require repeated typing
- Slower workflows for power users

---

## Friction Point 5: Hotkey Context Confusion

**Description:** Some hotkeys only work in specific contexts but there's no indication of which shortcuts are available on the current page.

**Severity:** Medium

**Affected User Journeys:**
- All keyboard-driven workflows

**Context-Dependent Examples:**

| Hotkey | Dashboard | Document | Journal | Search |
|--------|-----------|----------|---------|--------|
| `Ctrl+N` | New doc | - | Next day | - |
| `Ctrl+P` | - | - | Prev day | - |
| `j/k` | Navigate list | - | Navigate entries | Navigate results |
| `Space` | Select item | - | Select entry | - |
| `Escape` | - | Exit editor | Clear selection | Unfocus input |

**User Experience:**
```
On Journal page, Ctrl+N = next day
    ↓
User switches to Dashboard
    ↓
User presses Ctrl+N expecting next day
    ↓
New document is created (unexpected!)
```

**Impact:**
- Same key does different things
- Accidental actions from wrong context
- Must track mental state of current page

---

## Friction Point 6: Palette-to-CLI Transition Friction

**Description:** Users who outgrow the command palette have no smooth transition to the command line. The two systems have different capabilities and syntax.

**Severity:** Medium

**Affected User Journeys:**
- Power user progression

**Learning Curve:**
```
Beginner: Uses mouse and sidebar
    ↓
Intermediate: Discovers Ctrl+K palette
    ↓
Advanced: Wants batch operations
    ↓
CLI syntax completely different from palette commands
    ↓
Must learn new system from scratch
```

**No Bridge Features:**
- Palette doesn't show equivalent CLI commands
- CLI doesn't suggest palette alternatives
- Help modal doesn't map between systems

**Impact:**
- Sharp learning curve at advanced stage
- Users stick with less efficient palette
- Power features underutilized

---

## Friction Point 7: Modal Input States Unclear

**Description:** The application has several modal states (command palette open, command line focused, editor focused, selection mode) but visual indication of current mode is subtle.

**Severity:** Low

**Affected User Journeys:**
- Any keyboard interaction

**Modal States:**

| State | Visual Indication | Keyboard Behavior |
|-------|-------------------|-------------------|
| Palette open | Overlay visible | All keys go to palette |
| CLI focused | Cursor in CLI | Keys type in CLI |
| Editor focused | Cursor in editor | Keys type in editor |
| List navigation | Highlighted item | j/k navigate, Space selects |
| Selection mode | Checkmarks visible | Different actions available |

**Confusion Points:**
- Is the editor focused or not? (affects Escape behavior)
- Is the CLI focused? (affects `:` behavior)
- Am I in selection mode? (affects delete behavior)

**Impact:**
- Keys do unexpected things
- Must visually verify focus state
- Subtle mode errors

---

## Friction Point 8: Editor Focus Trapping

**Description:** The BlockNote editor captures keyboard focus aggressively. Users must explicitly escape to use application shortcuts.

**Severity:** Low

**Affected User Journeys:**
- [[user-journeys#Journey 1: Create a New Document]]

**Current Behavior:**
```
User is editing document
    ↓
User presses Ctrl+K (expecting palette)
    ↓
Editor intercepts key (nothing happens or inserts something)
    ↓
User must press Ctrl+C or click outside to unfocus
    ↓
Then Ctrl+K works
```

**Workarounds Documented:**
- `Ctrl+C` unfocuses editor (Document page specific)
- Click outside editor to unfocus
- Some shortcuts work via capture phase

**Impact:**
- Palette not accessible from editor
- Must learn editor escape sequence
- Breaks flow of writing + commanding

---

## Friction Point 9: No Unified Input Mode

**Description:** There's no single "power mode" that combines all input methods. Users must mentally switch between systems.

**Severity:** Low

**Affected User Journeys:**
- Advanced workflows

**Desired Experience:**
```
Single command interface that:
- Shows available commands (like palette)
- Accepts typed commands (like CLI)
- Displays keyboard shortcuts
- Works from any context
```

**Current Reality:**
- Three separate systems
- Different capabilities in each
- No unification layer

**Impact:**
- Cognitive load of multiple systems
- Fragmented muscle memory
- No single "expert interface"

---

## Summary Table

| ID | Friction Point | Severity | Key Impact |
|----|----------------|----------|------------|
| IM-1 | Three overlapping command systems | High | Decision paralysis |
| IM-2 | Command line absent on some pages | High | Broken muscle memory |
| IM-3 | No autocomplete in CLI | Medium | Must memorize syntax |
| IM-4 | No command history | Medium | Repeated typing |
| IM-5 | Hotkey context confusion | Medium | Same key, different action |
| IM-6 | Palette-to-CLI transition | Medium | Sharp learning curve |
| IM-7 | Modal states unclear | Low | Unexpected key behavior |
| IM-8 | Editor focus trapping | Low | Can't access palette |
| IM-9 | No unified input mode | Low | Fragmented experience |

---

## Recommendations

### High Priority

1. **Add Command Line to All Pages**
   - Even if limited commands, consistency helps
   - Or clearly indicate "No commands on this page"

2. **Bridge Palette and CLI**
   - Show CLI equivalent in palette hints
   - "New Document" → hint shows `:new`
   - Helps users learn CLI from palette

3. **Add CLI Autocomplete**
   - Tab completion for command names
   - Suggestions dropdown as user types
   - Context-aware (show commands for current page)

### Medium Priority

4. **Implement Command History**
   - Up/Down arrows recall previous commands
   - Persist across sessions (localStorage)
   - Standard shell behavior users expect

5. **Show Context-Specific Shortcut Hints**
   - Footer showing shortcuts for current page
   - Changes as user navigates
   - Reduces context confusion

6. **Improve Focus State Visibility**
   - Clear visual indicator of current mode
   - "You are editing" vs "Navigation mode"

### Low Priority

7. **Allow Palette from Editor**
   - `Ctrl+K` should work even when editor focused
   - Higher priority handler or capture phase

8. **Consider Unified Command Interface**
   - Long-term: single powerful interface
   - Combines palette discoverability with CLI power
   - Similar to VS Code's command palette with typed commands

---

## Comparison with Industry Standards

### VS Code
- Single command palette (`Ctrl+Shift+P`)
- Can type `>` prefix for commands
- Shows keyboard shortcuts in hints
- Available from any context

### Obsidian
- Command palette (`Ctrl+P`)
- Hotkeys customizable
- No CLI, all via palette
- Templates for common actions

### Vim
- Modal editing (normal, insert, command)
- `:` enters command mode
- Clear mode indicators
- Consistent model

### YANTA Current State
- Multiple systems without clear hierarchy
- Some VS Code patterns, some Vim patterns
- No single expert interface
- Room for consolidation

---

## Related Documentation

- [[command-palette]] - Palette documentation
- [[command-line]] - Command line documentation
- [[command-palette-audit]] - Detailed palette analysis
- [[command-line-audit]] - Detailed CLI analysis
- [[keyboard-shortcuts]] - Shortcut catalog
