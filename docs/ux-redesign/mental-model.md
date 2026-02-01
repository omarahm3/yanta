---
type: architecture
title: Core Mental Model
created: 2026-02-01
tags:
  - ux-redesign
  - mental-model
related:
  - "[[documents-vs-journal]]"
  - "[[command-palette-design]]"
  - "[[quick-access]]"
  - "[[adr-001-command-palette-first]]"
---

# Core Mental Model

This document defines the foundational mental model for YANTA's information architecture. It establishes clear definitions for each core concept, their relationships, and provides user-facing descriptions suitable for onboarding.

---

## Design Philosophy

YANTA is built around a **command-palette-first** paradigm: users should be able to accomplish any task without reaching for the mouse. The mental model supports this by establishing clear, distinct concepts that can be quickly invoked through keyboard commands.

---

## Core Concepts

### 1. Documents

**Definition:** Documents are long-form, structured notes designed for project documentation and building a personal knowledge base. They support rich text formatting, including headings, lists, code blocks, images, and links.

**Characteristics:**
- Rich text content (Markdown-compatible BlockNote editor)
- Individual files with full metadata (title, tags, timestamps, word count)
- Organized by project
- Auto-save with version history
- Support for cross-references and wiki-links
- Exportable to Markdown and PDF

**Mental Model:** Think of Documents as **wiki pages** or **project documentation**. Each Document is a standalone artifact that you craft, refine, and reference over time.

**Access Patterns:**
| Method | Command | Context |
|--------|---------|---------|
| Command Palette | `Ctrl+K` → "New Document" | Global |
| Command Palette | `Ctrl+K` → "Open Document" | Global |
| Keyboard Shortcut | `Ctrl+N` | Dashboard |
| Command Line | `:new [title]` | Dashboard |
| Navigation | Dashboard → Click document | Dashboard |

**Onboarding Description:**
> Documents are your project notes and knowledge base. Create rich, formatted pages with headings, code blocks, and images. Documents live within projects and can be searched, tagged, and exported.

---

### 2. Journal

**Definition:** Journal is a time-indexed collection of quick notes organized by date. Journal entries are captured rapidly via Quick Capture and stored as plain text, making them ideal for fleeting thoughts, daily logs, and quick ideas.

**Characteristics:**
- Plain text content (max 10,000 characters per entry)
- Date-based organization (entries grouped by day)
- Multiple entries per day
- Minimal metadata (timestamp, tags, deleted flag)
- Read-only display with edit-in-modal pattern
- Supports bulk operations (multi-select, delete, promote)

**Mental Model:** Think of Journal as a **daily diary** or **thought stream**. It's where Quick Capture content lands, organized automatically by date. Review your day's notes, then promote important ones to Documents.

**Access Patterns:**
| Method | Command | Context |
|--------|---------|---------|
| Command Palette | `Ctrl+K` → "Go to Journal" | Global |
| Sidebar | Click "journal" | Global |
| Quick Capture | System hotkey → type → `Ctrl+Enter` | Global |
| Search | Click journal entry in results | Search Page |

**Onboarding Description:**
> Journal is your daily thought stream. Quick Capture saves notes here, organized by date. Review your day, then promote important ideas to full Documents.

---

### 3. Quick Capture

**Definition:** Quick Capture is the fast-entry mechanism for capturing thoughts with minimal friction. It's a floating overlay window that accepts plain text and saves directly to Journal.

**Characteristics:**
- Zero-friction entry (global hotkey → type → `Ctrl+Enter`)
- Floating overlay window (separate from main app)
- Plain text input with syntax highlighting
- Inline tag support (`#tag` parsed and stored as metadata)
- Project routing (`@project` syntax or dropdown selection)
- Always saves to today's Journal
- Character limit enforced (10,000 chars)

**Mental Model:** Think of Quick Capture as a **system-wide scratchpad**. Invoke it from anywhere, jot down your thought, and dismiss it. The content flows into your Journal automatically.

**Access Patterns:**
| Method | Command | Context |
|--------|---------|---------|
| System Hotkey | Configurable global shortcut | Anywhere (system-wide) |
| Tag routing | Type `#tag` inline | Within Quick Capture |
| Project routing | Type `@project` inline or use dropdown | Within Quick Capture |

**Onboarding Description:**
> Quick Capture is your system-wide scratchpad. Press the hotkey from anywhere, type your thought, and hit `Ctrl+Enter`. Notes land in your Journal, ready for review later.

---

### 4. Projects

**Definition:** Projects are organizational containers that scope Documents and Journal entries. Each project has a unique alias (e.g., `@work`, `@personal`) and contains its own set of content.

**Characteristics:**
- Unique alias identifier (e.g., `@work`, `@personal`)
- Scopes Documents and Journal entries
- File storage isolation (content in `projects/@alias/` folder)
- Switchable context via sidebar or command palette
- Git-backed for version control (per-project history)
- Archivable with restoration capability

**Mental Model:** Think of Projects as **workspaces** or **contexts**. Switch projects to focus on a specific area of your work or life. Each project maintains its own documents, journal, and settings.

**Access Patterns:**
| Method | Command | Context |
|--------|---------|---------|
| Command Palette | `Ctrl+K` → "Switch Project" | Global |
| Sidebar | Click project in PROJECTS section | Global |
| Quick Capture | Type `@project` in content | Quick Capture |
| Command Line | `:project @alias` | Dashboard |

**Onboarding Description:**
> Projects are workspaces for different areas of your life. Switch between @work and @personal to keep notes separate. Each project has its own documents and journal.

---

## Concept Relationships

### Visual Hierarchy Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           PROJECTS                                  │
│                    (Organizational Container)                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                        @personal                             │   │
│   │   ┌───────────────────────┐   ┌───────────────────────────┐ │   │
│   │   │      DOCUMENTS        │   │        JOURNAL            │ │   │
│   │   │   (Knowledge Base)    │   │    (Daily Stream)         │ │   │
│   │   │                       │   │                           │ │   │
│   │   │  ┌─────────────────┐  │   │  ┌─────────────────────┐  │ │   │
│   │   │  │ Project Notes   │  │   │  │ 2026-01-15          │  │ │   │
│   │   │  │ (rich text)     │  │   │  │  - Entry 1          │  │ │   │
│   │   │  └─────────────────┘  │   │  │  - Entry 2          │  │ │   │
│   │   │  ┌─────────────────┐  │   │  └─────────────────────┘  │ │   │
│   │   │  │ Meeting Notes   │  │   │  ┌─────────────────────┐  │ │   │
│   │   │  │ (rich text)     │  │   │  │ 2026-01-16          │  │ │   │
│   │   │  └─────────────────┘  │   │  │  - Entry 1          │  │ │   │
│   │   │  ┌─────────────────┐  │   │  └─────────────────────┘  │ │   │
│   │   │  │ Research Doc    │  │   │                           │ │   │
│   │   │  │ (rich text)     │  │   │         ▲                 │ │   │
│   │   │  └─────────────────┘  │   │         │                 │ │   │
│   │   │         ▲             │   │         │ saves to        │ │   │
│   │   └─────────│─────────────┘   └─────────│─────────────────┘ │   │
│   │             │                           │                   │   │
│   │             │ promote                   │                   │   │
│   │             │                   ┌───────┴───────┐           │   │
│   │             └───────────────────│ QUICK CAPTURE │           │   │
│   │                                 │ (Fast Entry)  │           │   │
│   │                                 └───────────────┘           │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                          @work                               │   │
│   │            (Same structure, different content)               │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
                            USER INPUT
                                 │
           ┌─────────────────────┼─────────────────────┐
           │                     │                     │
           ▼                     ▼                     ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │   Command   │      │    Quick    │      │   Direct    │
    │   Palette   │      │   Capture   │      │  Document   │
    │   Ctrl+K    │      │   Hotkey    │      │   Editor    │
    └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
           │                    │                    │
           │                    ▼                    │
           │             ┌─────────────┐             │
           │             │   JOURNAL   │             │
           │             │  (entries)  │◄────────────┤
           │             └──────┬──────┘             │
           │                    │                    │
           │                    │ promote            │
           │                    ▼                    │
           │             ┌─────────────┐             │
           └────────────►│  DOCUMENTS  │◄────────────┘
                         │   (files)   │
                         └──────┬──────┘
                                │
                                ▼
                         ┌─────────────┐
                         │   PROJECT   │
                         │  (storage)  │
                         └─────────────┘
```

### Content Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        CONTENT LIFECYCLE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   CAPTURE            ORGANIZE              REFINE              │
│                                                                 │
│  ┌─────────┐        ┌─────────┐         ┌─────────┐           │
│  │ Quick   │───────►│ Journal │────────►│Document │           │
│  │ Capture │ saves  │ Entry   │ promote │  Page   │           │
│  └─────────┘        └─────────┘         └─────────┘           │
│       │                  │                   │                 │
│       │                  │                   │                 │
│       ▼                  ▼                   ▼                 │
│  Fleeting idea      Daily review        Long-term             │
│  captured in        and triage          knowledge             │
│  seconds                                 artifact             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ALTERNATIVE PATH: Direct Document Creation                    │
│                                                                 │
│       ┌─────────────────────────────────────────────┐          │
│       │ Command Palette → "New Document"            │          │
│       │ (Skip capture phase for substantial content)│          │
│       └─────────────────────────────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Concept Comparison Table

| Aspect | Documents | Journal | Quick Capture | Projects |
|--------|-----------|---------|---------------|----------|
| **Purpose** | Knowledge base | Daily stream | Fast capture | Organization |
| **Content type** | Rich text | Plain text | Plain text | Container |
| **Storage** | Individual files | Date-grouped files | N/A (saves to Journal) | Folder |
| **Organization** | By project | By date + project | N/A | Top-level |
| **Primary access** | Command palette, Dashboard | Calendar, Quick Capture | System hotkey | Sidebar, palette |
| **Typical size** | 100+ words | 1-50 words | 1-50 words | Many items |
| **Editing** | Full editor | Modal dialog | Inline textarea | Settings |
| **Lifecycle** | Persistent | Ephemeral → promote | Transient | Persistent |

---

## Onboarding Descriptions Summary

These concise descriptions are suitable for onboarding tooltips, help text, and new user guidance:

| Concept | Onboarding Description |
|---------|------------------------|
| **Documents** | Documents are your project notes and knowledge base. Create rich, formatted pages with headings, code blocks, and images. Documents live within projects and can be searched, tagged, and exported. |
| **Journal** | Journal is your daily thought stream. Quick Capture saves notes here, organized by date. Review your day, then promote important ideas to full Documents. |
| **Quick Capture** | Quick Capture is your system-wide scratchpad. Press the hotkey from anywhere, type your thought, and hit `Ctrl+Enter`. Notes land in your Journal, ready for review later. |
| **Projects** | Projects are workspaces for different areas of your life. Switch between @work and @personal to keep notes separate. Each project has its own documents and journal. |

---

## Design Principles Derived from Mental Model

1. **Clear Boundaries**: Each concept has a distinct purpose. Don't blur Documents and Journal—they serve different cognitive needs.

2. **Predictable Flow**: Quick Capture → Journal → Documents is the natural progression. Users should always know where their content lands.

3. **Context Preservation**: Projects scope everything. Switching projects should feel like opening a different notebook.

4. **Keyboard Primacy**: Every concept can be accessed and manipulated via keyboard. Mouse is optional, never required.

5. **Progressive Disclosure**: Quick Capture is simple. Journal adds organization. Documents add richness. Users grow into complexity.

---

## Related Documentation

- [[documents-vs-journal]] - Detailed analysis from UX audit
- [[command-palette-design]] - Primary navigation interface design
- [[quick-access]] - Unified quick access system design
- [[adr-001-command-palette-first]] - Architecture decision record for command palette primacy
