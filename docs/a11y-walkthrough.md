# Accessibility Walkthrough

Last updated: 2026-06-11 (YANA-41)

## Keyboard Navigation

### Landmarks (screen-reader navigable)

| Landmark | Role | How to reach |
|---|---|---|
| Sidebar navigation | `<nav>` with `aria-label="Sidebar navigation"` | Rotor / landmark navigation |
| Main content | `<div role="main">` | Rotor / landmark navigation |
| Page header | `role="region" aria-label="Page header"` | Rotor / landmark navigation |
| Keyboard shortcuts bar | `<div aria-label="Keyboard shortcut hints">` | Rotor / landmark navigation |

### Tab order

1. **Skip-to-content link** — first tab stop (visible on focus via `sr-only focus:not-sr-only`)
2. **Sidebar items** — each item is a `<li>` inside a `<ul>`, receives `aria-current="page"` when active
3. **Table rows (DocumentList, SearchResults)** — rows are `role="row"` with `tabIndex={0}`, cells are `role="gridcell"` with `tabIndex={-1}`
4. **Buttons** — `aria-disabled` set when disabled (screen reader announces as disabled)
5. **Form inputs (Input, Select, Checkbox)** — `aria-invalid` set when in error state

### Focus indicators

- Global `:focus-visible` rule: 2px solid accent color, 2px offset (`tailwind.css:264-282`)
- Mode-aware: `documents` uses blue accent, `journal` uses purple accent, `neutral` uses blue
- `data-reduced-effects` mode collapses all backdrop-blur, animations, and shadows

## Reduced Motion

### OS-level `prefers-reduced-motion: reduce`

The global CSS guard at `tailwind.css:429-440` collapses all `animation-duration` and `transition-duration` to 0.01ms, effectively disabling animations for users who prefer reduced motion. This covers:

- Sidebar open/close slide transition
- Content fade-in on project switch
- Button press scale (`active:scale-95`)
- Table row hover highlight
- Dialog open/close animations (Radix)

### App-level reduced effects (`data-reduced-effects`)

A heavier toggle set via `tailwind.css:284-310`:

- Removes all `backdrop-filter: blur` (improves performance on low-end hardware / Linux compositing)
- Replaces glass backgrounds with solid surface colors
- Kills all animations, transitions, shadows, text-shadows, and filters
- Keeps enabled-state semantics visible for switches

## Screen Reader (VoiceOver / NVDA / Orca)

### Status announcements (`aria-live` regions)

| Region | Role | Purpose |
|---|---|---|
| StatusMessage | `role="status" aria-live="polite"` | Transient success/error/info messages |
| UpdateBanner | `aria-live="polite"` | App update notifications |
| MilestoneHint | `aria-live="polite"` | Context hints |
| Loading skeletons | `role="status"` + `aria-busy="true"` | Loading states |
| `announceForScreenReaders()` utility | Dynamic `aria-live="polite"` region | Programmatic announcements |

### ARIA attributes by component

| Component | Attributes |
|---|---|
| Button | `aria-disabled` (when disabled) |
| Input | `aria-invalid` (when error) |
| Sidebar items | `aria-current="page"` (active item) |
| Table rows | `aria-selected` (selected row) |
| Dialog (Modal) | Radix-managed `aria-modal`, `aria-labelledby` |
| Dialog close button | `aria-label="Close dialog (Escape)"` |
| Command palette | `DialogTitle`+`DialogDescription` with `sr-only` |
| Toast | Radix-managed `role="alert"` |
| Tooltip | Radix-managed, respects `prefers-reduced-motion` |
| Switch/Checkbox | Radix-managed ARIA |
| Select | Radix-managed ARIA |
| Window controls | `aria-label="Minimize/Maximize/Close window"` |
| Help modal sections | `aria-expanded`, `aria-controls`, `aria-label` with state |
| Search results | `aria-live="polite"` |

### Known gaps

- **BlockNote editor** — no explicit `role="textbox"` or `aria-label` detected (upstream editor concern)
- **Color contrast** — uses GitHub-dark/light palette; automated axe checks skip color-contrast (jsdom limitation). Verify in browser with axe DevTools or manually.
- **Cross-platform visual QA** — the ARIA changes are markup-only (no platform-specific code), but visual rendering should be confirmed on macOS, Windows, and Linux by a human reviewer.
