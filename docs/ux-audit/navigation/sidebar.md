---
type: research
title: Sidebar Navigation Documentation
created: 2026-02-01
tags:
  - ux-audit
  - navigation
related:
  - "[[command-palette]]"
  - "[[command-line]]"
  - "[[keyboard-shortcuts]]"
---

# Sidebar Navigation

This document details the sidebar component structure, sections, and behavior in YANTA.

## Component Architecture

### Core Files

| File | Purpose |
|------|---------|
| `frontend/src/components/ui/Sidebar.tsx` | Main sidebar component |
| `frontend/src/components/ui/MetadataSidebar.tsx` | Document metadata panel |
| `frontend/src/hooks/useSidebarSections.ts` | Dynamic section generation hook |
| `frontend/src/components/ui/List.tsx` | List item components |
| `frontend/src/components/Layout.tsx` | Layout integration with toggle |

### Data Models

```typescript
interface SidebarSection {
  id: string;
  title: string;           // e.g., "NAVIGATION", "PROJECTS"
  items: SidebarItem[];
}

interface SidebarItem {
  id: string;
  label: string;
  count?: number;          // Optional document count badge
  active?: boolean;        // Current selection state
  onClick?: () => void;    // Navigation handler
}
```

## Sidebar Sections

### 1. NAVIGATION (Always Present)

The primary navigation section with fixed items:

| Item | Route | Description |
|------|-------|-------------|
| dashboard | `/dashboard` | Main document workspace |
| projects | `/projects` | Project management |
| search | `/search` | Full-text search |
| journal | `/journal` | Quick notes timeline |
| settings | `/settings` | Application configuration |

### 2. PROJECTS (Conditional)

**Visibility Conditions:**
- At least one active project exists
- NOT on settings page
- NOT on document editor page

**Content:**
- Lists all active (non-archived) projects
- Each item shows project alias and document count
- Clicking switches the current project context
- Active project is highlighted

### 3. FILTERS (Conditional)

**Visibility Conditions:**
- `filters` array is provided via props
- Array contains at least one filter

**Content Types:**
- **Time Filters**: Date-range based filtering
- **Category Filters**: Content-type based filtering

Each filter shows display name and entry count.

### 4. ADDITIONAL SECTIONS (Optional)

Custom sections passed via `additionalSections` prop. Used by:
- **Settings Page**: Adds SETTINGS subsection navigation
  - general, appearance, database, shortcuts, logging, backup, sync, about

### 5. ARCHIVE (Conditional)

**Visibility Conditions:**
- Archived projects exist
- NOT on settings page
- NOT on document editor page

**Content:**
- Lists all archived projects
- Allows switching to archived project context

## Visual Design

### Dimensions
- **Width**: 192px (w-48)
- **Padding**: 20px (p-5)
- **Logo Area**: 48px width, 192px height

### Styling Classes

```css
.sidebar-item {
  @apply px-2 py-1.5 rounded cursor-pointer transition-colors
         duration-100 flex items-center justify-between text-text-dim
         hover:bg-border hover:text-text;
}

.sidebar-item.active {
  @apply font-semibold bg-accent text-bg;
}
```

### Theme Variables

```css
/* Light Mode */
--sidebar: oklch(0.985 0 0);
--sidebar-foreground: oklch(0.145 0 0);
--sidebar-accent: oklch(0.97 0 0);

/* Dark Mode */
--sidebar: oklch(0.205 0 0);
--sidebar-foreground: oklch(0.985 0 0);
--sidebar-accent: oklch(0.269 0 0);
```

## Behavioral Features

### Toggle/Collapse

The sidebar can be shown/hidden via keyboard shortcuts:

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Toggle sidebar visibility |
| `Mod+E` | Toggle sidebar visibility (alternate) |

**State Management:**
```typescript
const [sidebarVisible, setSidebarVisible] = useState(true);
```

The parent container uses `data-sidebar-visible` attribute for CSS targeting.

### Active State Highlighting

- Current page is determined by `currentPage` prop
- Active items receive `.active` class
- Visual treatment: bold text, accent background, inverse colors

### Navigation Flow

```
User clicks sidebar item
        ↓
ListItem onClick handler fires
        ↓
onNavigate?.("page-name") called
        ↓
Parent updates currentPage state
        ↓
Sidebar re-renders with updated active states
```

## MetadataSidebar

A separate sidebar panel for document-specific metadata.

### Dimensions
- **Width**: 240px (w-60)

### Sections Displayed

1. **Entry ID**: Document number
2. **Project**: Project name with color-coded badge
   - Work: Purple
   - Side: Green
   - Learn: Orange
3. **Type Badge**: Feature/Bug/Note with colors
4. **Created**: Timestamp
5. **Modified**: Last modified timestamp
6. **Tags**: Clickable tag chips
7. **Stats**: Word count, character count, code block count
8. **Actions**: Buttons with keyboard shortcut hints

## Page Integration Examples

### Dashboard
```tsx
<Layout
  sidebarSections={sidebarSections}
  currentPage="dashboard"
  showCommandLine={true}
/>
```

### Settings (Custom Sections)
```tsx
const sidebarSections = useSidebarSections({
  currentPage: "settings",
  onNavigate,
  additionalSections: [
    {
      id: "settings",
      title: "SETTINGS",
      items: settingsItems,
    },
  ],
});
```

## Key Features Summary

1. **Dynamic Section Generation**: Sections render based on application state
2. **Document Counts**: Projects and filters display entry counts
3. **Keyboard Toggle**: Ctrl+B or Mod+E to show/hide
4. **Active State Tracking**: Visual indication of current location
5. **Contextual Metadata**: MetadataSidebar shows document details
6. **Custom Sections**: Pages can inject additional navigation
7. **Archive Separation**: Archived projects in distinct section
8. **Filter Organization**: Grouped by type (time vs. category)
