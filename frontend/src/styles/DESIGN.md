# YANTA Design System

## Principles

1. **Keyboard-first, mouse-friendly.** Every action has a keyboard path; all interactive elements are visible and usable by mouse.
2. **Glassmorphism with restraint.** Frosted glass (backdrop-blur, translucent backgrounds) for surfaces overlaid on content; solid fills for primary actions and error states.
3. **No jank, no flash.** Instantly responsive UI, zero layout shift, no flash-of-unstyled-content.
4. **Dark by default, light available.** GitHub-inspired palette in both modes; `system` follows OS preference.
5. **Accessibility is not optional.** Visible focus rings, proper aria labels, reduced-motion support, color-contrast-compliant tokens.

## Color System

All colors are defined as CSS custom properties in `tailwind.css` and exposed as Tailwind theme tokens via `@theme inline`.

### Core Tokens

| Token               | Dark (default) | Light        | Usage                         |
|---------------------|----------------|--------------|-------------------------------|
| `--color-bg`        | `#0d1117`      | `#ffffff`    | Page background               |
| `--color-bg-dark`   | `#0a0e13`      | `#f6f8fa`    | App root, scrollbar track     |
| `--color-surface`   | `#161b22`      | `#f6f8fa`    | Cards, sidebar, command palette |
| `--color-border`    | `#30363d`      | `#d0d7de`    | Borders, dividers, strokes    |
| `--color-text`      | `#c9d1d9`      | `#1f2328`    | Body text                     |
| `--color-text-dim`  | `#8b949e`      | `#656d76`    | Secondary text, hints         |
| `--color-text-bright`| `#f0f6fc`     | `#0a0c0d`    | Headings, active/selected states |
| `--color-accent`    | `#58a6ff`      | `#0969da`    | Links, active items, primary CTAs |
| `--color-green`     | `#3fb950`      | `#1a7f37`    | Success, enabled switches     |
| `--color-red`       | `#f85149`      | `#cf222e`    | Destructive, errors           |
| `--color-yellow`    | `#d29922`      | `#9a6700`    | Warnings                      |
| `--color-purple`    | `#a371f7`      | `#8250df`    | Journal mode accent           |
| `--color-orange`    | `#fb8500`      | `#bc4c00`    | Highlight-todo                |
| `--color-on-accent` | `#ffffff`      | `#ffffff`    | Text on accent fills          |

### Glass Tokens

| Token                      | Dark                       | Light                      | Usage                          |
|----------------------------|----------------------------|----------------------------|---------------------------------|
| `--color-glass-bg`         | `rgba(22,27,34,0.7)`       | `rgba(246,248,250,0.7)`    | Frosted surface backgrounds      |
| `--color-glass-border`     | `rgba(48,54,61,0.5)`       | `rgba(208,215,222,0.5)`    | Borders on glass surfaces        |
| `--color-glass-bg-solid`   | `rgba(22,27,34,0.97)`      | `rgba(246,248,250,0.97)`   | Opaque fallback (reduced-effects)|
| `--color-glass-border-solid`| `rgba(48,54,61,0.8)`      | `rgba(208,215,222,0.8)`    | Opaque border fallback           |

### Mode Accents

Each page sets `data-mode` on the layout root to differentiate visual contexts:

| Mode        | Accent     | Usage                      |
|-------------|------------|----------------------------|
| `documents` | `--color-accent` (blue)  | Dashboard, document editor |
| `journal`   | `--color-purple`          | Journal entries            |
| `neutral`   | `--color-accent` (blue)  | Settings, search, projects |

## Typography

| Token          | Font Family                 | Usage                    |
|----------------|-----------------------------|--------------------------|
| `font-sans`    | `'Outfit', sans-serif`      | Body, headings, UI text  |
| `font-mono`    | `'JetBrains Mono', monospace`| Code, data, hotkeys, IDs |

### Type Scale

Use the `Heading` and `Text` components from `shared/ui` rather than raw HTML tags:

- `Heading` sizes: `xs`, `sm`, `base`, `lg`, `xl`, `2xl`, `3xl` — auto-defaults based on heading level
- `Text` sizes: `xs`, `sm`, `base`, `lg`, `xl`

### Component Font Conventions

- Body text: `font-sans`, size `sm` (`text-sm`)
- Code/inline data: `font-mono`
- Hotkeys: `font-mono` with `kbd` element
- Heading weights: `semibold` by default
- Section titles (sidebar, settings): `text-xs font-semibold uppercase tracking-wider`

## Spacing & Layout

- Standard outer padding: `p-5` (20px) on page content areas
- Sidebar width: `w-48` (192px)
- Card/dialog padding: `p-6`
- Between settings sections: `space-y-8`
- Between form elements: `space-y-4`
- Between related items in a list: `gap-2` or `space-y-1`

## Component Patterns

### Button

One component, four variants, three sizes:

```tsx
<Button variant="primary" size="md">Label</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="ghost">More</Button>
<Button variant="destructive">Delete</Button>
```

| Variant       | Visual                         | Usage                              |
|---------------|--------------------------------|------------------------------------|
| `primary`     | Accent filled                  | Primary CTAs, confirm actions      |
| `secondary`   | Glass border + backdrop-blur   | Cancel, secondary actions          |
| `ghost`       | Transparent, hover glass       | Toolbar, less prominent actions    |
| `destructive` | Red filled                     | Delete, dangerous irreversible actions |

**Rules:**
- Raw `<button>` should only appear if the component needs special styling not covered by the Button component (rare — check with the design team first).
- All icon-only buttons must have an `aria-label`.

### Input

```tsx
<Input variant="default" />        // Standard form input
<Input variant="ghost" />          // Borderless (for search/queries)
<Input error />                     // Error state (red border)
```

### Dialog / Modal

```tsx
<Dialog open={isOpen} onOpenChange={handleChange}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Optional description</DialogDescription>
    </DialogHeader>
    {/* content */}
    <DialogFooter>
      <Button variant="secondary">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Or for simple cases: `<Modal title="..." isOpen={isOpen} onClose={...}>`.

### Switch / Toggle

```tsx
<Switch checked={enabled} onCheckedChange={setEnabled} />
```

Matches the `+` icon naming in the settings barrel export as `Toggle`.

### Select

```tsx
<Select value={value} onChange={handleChange} options={[{value, label}]} />
```

### Toast

```tsx
const toast = useToast();
toast.success("Saved");
toast.error("Failed");
toast.info("Updated");
toast.warning("Disk space low");
```

### Tooltip

```tsx
<Tooltip tooltipId="create-note" content="Create a new note" shortcut="Ctrl+N">
  <Button>New</Button>
</Tooltip>
```

Only renders when the user has shortcut tooltips enabled in settings. Tracked by `tooltipId` for one-time nudges.

### EmptyState

```tsx
<EmptyState
  icon={<FileText />}
  title="No documents"
  description="Create your first document to get started."
  actionLabel="Create document"
  onAction={handleCreate}
/>
```

### Skeleton

```tsx
<Skeleton className="h-4 w-full" />
```

Pulsing placeholder — always `aria-hidden="true"`. Compose multiple to mirror the final layout.

### List

```tsx
<List variant="sidebar">
  <ListItem variant="sidebar" active>Active item</ListItem>
  <ListItem variant="sidebar">Regular item</ListItem>
</List>
```

## Keyboard-First UX

### Footer Hint Bar

The footer displays context-aware keyboard shortcuts. Three priority levels:

| Priority | Behavior                         |
|----------|----------------------------------|
| P1 (1)   | Always visible                   |
| P2 (2)   | Always visible (wraps on overflow)|
| P3 (3)   | Hidden below 768px               |

### Focus Management

- `:focus-visible` ring defined globally using `--color-accent` (blue) or `--color-purple` for journal mode
- Skip-to-content link at the top of every layout (visually hidden, focusable)
- Command palette traps focus while open
- Welcome overlay auto-focuses the dismiss button

### Hotkeys

Register with `useHotkey()` from `../hotkeys` — never with raw `addEventListener`. The system handles:
- Priority-based conflict resolution
- Input field awareness (skips hotkeys when typing in inputs)
- Cross-platform modifier detection (Ctrl vs Cmd)

## Glass Aesthetic

- Card backgrounds: `bg-glass-bg backdrop-blur-md border border-glass-border`
- Dialog/command palette: `bg-glass-bg/90 backdrop-blur-xl`
- Sidebar: `bg-glass-bg/50 backdrop-blur-xl`
- Header bar: `bg-glass-bg/40 backdrop-blur-md`
- Footer hints: `bg-glass-bg/60 backdrop-blur-md`

### Reduced-Effects Mode

Honored via `[data-reduced-effects="true"]`:
- All `backdrop-filter: none`
- All animations/transitions disabled
- Glass backgrounds become solid (`--color-glass-bg-solid`)
- Switches keep visible checked state

## Scrollbar

Always custom-styled to match the theme:
- Thin (8px width), transparent track
- `border`-colored thumb with rounded full and content-box clip
- Hover to `text-dim`

---

*This document is the single source of truth for YANTA's visual language. All components must use design tokens from `tailwind.css` — never hardcoded colors. If a token doesn't exist, add it first to the CSS variables, then reference it here.*
