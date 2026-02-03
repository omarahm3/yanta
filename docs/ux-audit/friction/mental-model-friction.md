---
type: analysis
title: Mental Model Friction Points
created: 2026-02-01
tags:
  - ux-audit
  - friction
  - mental-model
related:
  - "[[documents-vs-journal]]"
  - "[[user-journeys]]"
  - "[[navigation-friction]]"
  - "[[discoverability-friction]]"
---

# Mental Model Friction Points

This document identifies and analyzes friction points related to conceptual confusion, where the application's model of data and behavior doesn't align with user expectations.

## Summary

Mental model friction occurs when users' expectations about how something should work differ from how it actually works. This includes confusion about data types, relationships, terminology, and behavior patterns.

---

## Friction Point 1: Documents vs Journal Distinction Unclear

**Description:** Users don't immediately understand the difference between Documents (rich text, persistent) and Journal entries (plain text, date-organized, ephemeral). Both are "notes" in the user's mental model.

**Severity:** High

**Affected User Journeys:**
- [[user-journeys#Journey 1: Create a New Document]]
- [[user-journeys#Journey 2: Quick Capture a Note to Journal]]

**User Mental Model:**
```
"I want to write something"
       ↓
Where does it go?
       ↓
┌─────────────────┐
│   ???          │  ← Confusion about choice
└─────────────────┘
```

**Application Model:**
```
Documents                    Journal
├─ Rich text (BlockNote)     ├─ Plain text only
├─ Individual files          ├─ Date-grouped files
├─ Title required            ├─ No title
├─ Accessed via Dashboard    ├─ Accessed via Journal page
├─ Created via Ctrl+N        ├─ Created via Quick Capture
└─ Long-form content         └─ Quick notes
```

**Impact:**
- Users put long content in Journal when Document is appropriate
- Users create documents for quick thoughts when Journal is better
- Time spent in wrong context

**Evidence:** [[documents-vs-journal]] provides detailed analysis of this distinction.

---

## Friction Point 2: Quick Capture Destination Ambiguity

**Description:** When users capture a note via Quick Capture, it goes to Journal, but users often expect it to appear in Documents or be visible on Dashboard.

**Severity:** High

**Affected User Journeys:**
- [[user-journeys#Journey 2: Quick Capture a Note to Journal]]

**User Expectation:**
```
Quick Capture → "Meeting notes @work"
                     ↓
User thinks: "My note is now in my work documents"
                     ↓
User checks Dashboard → Not found
                     ↓
Confusion and frustration
```

**Actual Behavior:**
- Quick Capture always saves to Journal
- Entry appears on Journal page under today's date
- Not visible on Dashboard at all

**Impact:**
- Users think notes are lost
- Repeated searches for "missing" notes
- Distrust of Quick Capture feature

---

## Friction Point 3: "Dashboard" vs "Documents" Terminology

**Description:** The sidebar says "dashboard" but the page shows a document list. Users expect "Dashboard" to be a hub/overview, not the document browser.

**Severity:** Medium

**Affected User Journeys:**
- [[user-journeys#Journey 1: Create a New Document]]
- [[user-journeys#Journey 5: Navigate from Dashboard to Journal]]

**Terminology Mismatch:**
| UI Element | User Expectation | Actual Content |
|------------|------------------|----------------|
| "dashboard" sidebar item | Overview/stats/widgets | Document list |
| Dashboard page | At-a-glance info | Full document browser |

**Impact:**
- Users look for "documents" link that doesn't exist
- Mental effort to remember "dashboard" = "documents"
- New users are confused about where documents live

**Evidence:** [[documents-vs-journal#Points of Confusion]] identifies this as confusion point #6.

---

## Friction Point 4: Tag Behavior Inconsistency

**Description:** Tags work differently across Documents, Journal, and Quick Capture. Users expect one consistent tagging model.

**Severity:** Medium

**Affected User Journeys:**
- [[user-journeys#Journey 1: Create a New Document]]
- [[user-journeys#Journey 2: Quick Capture a Note to Journal]]

**Three Different Tag Models:**

| Context | Input Method | Storage | Display |
|---------|--------------|---------|---------|
| Documents | `:tag mytag` command | Metadata field | Chips in sidebar |
| Journal | `#tag` inline | Extracted to metadata | Inline with content |
| Quick Capture | `#tag` inline | Extracted to metadata | Stripped from content |

**User Confusion:**
- "Why can't I use `#tag` in documents?"
- "Why did my `#tag` disappear from the Journal entry text?"
- "Why do I need a command to add tags to documents?"

**Impact:**
- Learning three systems instead of one
- Tags added incorrectly and lost
- Inconsistent data organization

**Evidence:** [[documents-vs-journal#Points of Confusion]] identifies this as confusion point #4.

---

## Friction Point 5: Promotion Workflow Unclear

**Description:** "Promote to Doc" converts a Journal entry to a Document, but users don't know what happens to the original entry or how the data transforms.

**Severity:** Medium

**Affected User Journeys:**
- [[user-journeys#Journey 2: Quick Capture a Note to Journal]] (follow-up)

**User Questions:**
1. Is the original Journal entry kept or deleted?
2. Where does the new Document appear?
3. What happens to my tags?
4. Can I undo this?
5. Will the timestamp be preserved?

**Current Behavior:**
- Original entry is kept (unless manually deleted)
- New Document appears in current project
- Tags are copied to Document metadata
- Cannot be undone (no link between entry and doc)

**Missing Communication:**
- No confirmation dialog explaining the action
- No post-promotion feedback
- No link to the created document

**Impact:**
- Users avoid promotion due to uncertainty
- Duplicate content if original not deleted
- Lost sense of data lineage

---

## Friction Point 6: Project as Container vs Filter

**Description:** Users sometimes think of projects as folders (containers) and sometimes as filters (views). The application treats them as containers, but the UI sometimes behaves like filtering.

**Severity:** Medium

**Affected User Journeys:**
- [[user-journeys#Journey 4: Switch Between Projects]]

**Conceptual Ambiguity:**

| Project as Container | Project as Filter |
|---------------------|-------------------|
| Documents "belong to" project | Documents "tagged with" project |
| Switch project = change context | Switch project = change view |
| Can't see across projects | Can search across projects |

**Actual Behavior:** Projects are containers. Documents belong to one project. Switching projects changes context entirely.

**Confusion Point:** Search can find content across projects, making it seem like projects are filters.

**Impact:**
- Users expect to see "all documents" somewhere
- Surprise when project switch hides documents
- Mental effort to track which project is active

---

## Friction Point 7: Archive vs Delete Distinction

**Description:** Both Archive and Delete exist for Documents, but users don't understand when to use which, or how they differ.

**Severity:** Low

**Affected User Journeys:**
- Document management

**Two Removal Mechanisms:**

| Action | Behavior | Reversibility | Access |
|--------|----------|---------------|--------|
| Archive | Moves to ARCHIVE section | Easy restore | Visible in archived view |
| Soft Delete | Sets `deletedAt` | Restore possible | Hidden by default |
| Hard Delete | Permanent removal | Cannot restore | Gone forever |

**User Confusion:**
- "What's the difference between archive and delete?"
- "Where did my archived document go?"
- "How do I permanently remove something?"

**Impact:**
- Users archive when they mean delete (or vice versa)
- "Deleted" documents still take space
- Confusion about what's actually removed

---

## Friction Point 8: Search Results Type Ambiguity

**Description:** Search returns both Documents and Journal entries in the same list. Users may not realize they're looking at different content types with different capabilities.

**Severity:** Low

**Affected User Journeys:**
- [[user-journeys#Journey 3: Search Across All Content]]

**Current Display:**
```
Search results for "meeting"

┌──────────────────────────────────────────────┐
│ 📄 Document  │ Q4 Meeting Notes     │ @work  │
├──────────────────────────────────────────────┤
│ 📝 Note      │ Discussed budget...  │ @work  │
└──────────────────────────────────────────────┘
      ↑
Type badge (Document vs Note)
```

**Potential Confusion:**
- Users click "Note" expecting Document editor
- Different capabilities after navigation (edit vs read-only)
- Mental context switch required

**Impact:**
- Unexpected page types after navigation
- Different available actions for each type
- Need to learn two result-handling patterns

---

## Friction Point 9: No Global "All Content" View

**Description:** There is no single view showing all documents and journal entries across all projects. Users must either search or navigate project by project.

**Severity:** Low

**Affected User Journeys:**
- Content overview and organization

**User Expectation:** "Show me everything I've written"

**Current Reality:**
- Dashboard: Documents for current project only
- Journal: Entries for current project and selected date only
- Search: Only shows results matching a query

**Missing:**
- "All Documents" view across projects
- "All Journal Entries" timeline
- Recent activity feed

**Impact:**
- No birds-eye view of content
- Hard to audit what exists
- Fragmented mental model of data

---

## Summary Table

| ID | Friction Point | Severity | Key Impact |
|----|----------------|----------|------------|
| MM-1 | Documents vs Journal distinction | High | Wrong content type choice |
| MM-2 | Quick Capture destination ambiguity | High | "Lost" notes |
| MM-3 | Dashboard vs Documents terminology | Medium | Can't find documents |
| MM-4 | Tag behavior inconsistency | Medium | Three systems to learn |
| MM-5 | Promotion workflow unclear | Medium | Avoided feature |
| MM-6 | Project as container vs filter | Medium | Context confusion |
| MM-7 | Archive vs Delete distinction | Low | Wrong removal action |
| MM-8 | Search results type ambiguity | Low | Unexpected navigation |
| MM-9 | No global content view | Low | Fragmented overview |

---

## Recommendations

### High Priority

1. **Clarify Content Types in Onboarding**
   - First-run explanation: "Documents for long content, Journal for quick notes"
   - Visual distinction between creation paths

2. **Show Quick Capture Destination**
   - Success notification: "Saved to Journal"
   - Optional: "Save as Document instead" option in Quick Capture

3. **Rename "dashboard" to "documents"**
   - Align terminology with content
   - Reduce mental mapping effort

### Medium Priority

4. **Unify Tag Input**
   - Support `#tag` syntax in Documents
   - Or add tag input field to all contexts
   - Consistent behavior reduces learning curve

5. **Improve Promotion Flow**
   - Confirmation dialog explaining what will happen
   - Option to keep or delete original
   - Link to created document in success message

6. **Add "All Documents" View**
   - Optional cross-project document list
   - Helps users understand full content scope

### Low Priority

7. **Clarify Archive vs Delete**
   - Contextual help text explaining difference
   - Consider consolidating to single "Archive" with permanent delete in archive view

8. **Enhance Search Result Type Indicators**
   - Larger/clearer type badges
   - Preview showing content type capabilities

---

## Related Documentation

- [[documents-vs-journal]] - Detailed concept analysis
- [[user-journeys]] - User flow documentation
- [[navigation-friction]] - Navigation issues
- [[discoverability-friction]] - Feature discovery issues
