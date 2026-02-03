---
type: decision
title: "ADR-002: Sidebar Off by Default"
created: 2026-02-01
status: proposed
tags:
  - adr
  - ux-redesign
  - sidebar
  - settings
related:
  - "[[sidebar-toggle]]"
  - "[[mental-model]]"
  - "[[adr-001-command-palette-first]]"
  - "[[quick-access]]"
---

# ADR-002: Sidebar Off by Default

## Status

**Proposed** - Awaiting user review and approval

## Context

YANTA currently displays a sidebar by default on the left side of the screen. This sidebar provides navigation links to Dashboard, Projects, Search, Journal, and Settings.

### Current Implementation

| Aspect | Current State |
|--------|---------------|
| **Default Visibility** | Visible (`useState(true)`) |
| **Toggle Mechanism** | `Ctrl+B` (Windows/Linux), `Cmd+E` (macOS) |
| **Persistence** | Not persisted (resets on refresh) |
| **Settings Control** | None (hotkey only) |
| **Width** | 192px fixed |

### Problems with Current Approach

#### Conflicts with Command-Palette-First

The [[adr-001-command-palette-first]] decision establishes the command palette as the primary navigation interface. A visible sidebar:

- Suggests clicking is the primary navigation method
- Draws attention away from keyboard-first workflow
- Creates visual competition with palette-centric design

#### Screen Space Consumption

The 192px sidebar width:

- Reduces content area on all screens
- Particularly impactful on smaller displays (laptops)
- Provides no additional functionality beyond palette

#### Redundant Navigation

Every sidebar link has a command palette equivalent:

| Sidebar Link | Palette Command | Shortcut |
|--------------|-----------------|----------|
| Dashboard | "Go to Dashboard" | - |
| Projects | "Go to Projects" | - |
| Search | "Go to Search" | `Ctrl+Shift+F` |
| Journal | "Go to Journal" | `Ctrl+J` |
| Settings | "Go to Settings" | `Ctrl+,` |

The sidebar provides no exclusive functionality.

#### Inconsistent with Modern Design Trends

Applications prioritizing keyboard navigation (VS Code command palette, Raycast, Alfred, Linear, Notion's `/` commands) typically:

- Start with minimal chrome
- Let users opt into visual navigation
- Maximize content area by default

### UX Audit Findings

From [[discoverability-friction]]:
> "The sidebar is always visible but provides no information that couldn't be accessed via `Ctrl+K`. For keyboard-first users, it's visual noise; for mouse users, it's a distraction from the more powerful palette."

## Decision

**Make the sidebar hidden by default, with a setting and keyboard shortcut to show it.**

### What This Means

1. **New default:** Sidebar visibility is `false`
2. **Persisted setting:** Sidebar preference survives refresh/restart
3. **Easy toggle:** `Ctrl+B` toggles sidebar at any time
4. **Settings UI:** Toggle available in Appearance section
5. **No functionality loss:** All navigation via command palette

### Behavior Summary

| Sidebar Setting | Behavior |
|-----------------|----------|
| **Off (default)** | Main content spans full width; use `Ctrl+K` for navigation |
| **On** | Sidebar visible on left; content width reduced by 192px |

### New User Experience

1. User opens YANTA for first time
2. Sees clean, content-focused interface (no sidebar)
3. Brief onboarding hint: "Press `Ctrl+K` to navigate, `Ctrl+B` to show sidebar"
4. User navigates via palette; learns shortcuts from badges
5. If user prefers visual nav, they enable sidebar in Settings

### Power User Experience

1. User navigates entirely via keyboard shortcuts
2. Sidebar remains hidden (default)
3. Maximum screen real estate for content
4. Clean, distraction-free interface

### Visual Nav Preference Experience

1. User prefers seeing navigation structure
2. Presses `Ctrl+B` or enables in Settings
3. Sidebar appears and persists across sessions
4. User can use sidebar OR palette interchangeably

## Consequences

### Positive

1. **Cleaner Default Interface** - More content space, less chrome
2. **Reinforces Palette-First** - Users naturally gravitate to `Ctrl+K`
3. **Modern Aesthetics** - Aligns with minimalist keyboard-first apps
4. **User Choice** - Those who want sidebar can easily enable it
5. **Consistent with ADR-001** - Supports command-palette-first paradigm

### Negative

1. **Adjustment Period** - Users expect sidebar; initial disorientation
2. **Discoverability Concern** - New users may not know how to navigate
3. **Feature Perception** - Hidden features may seem "missing"
4. **Support Inquiries** - "Where did the sidebar go?" questions expected

### Neutral

1. **No Functionality Change** - Sidebar still exists, just hidden
2. **Implementation Effort** - Minor backend/frontend changes required
3. **Existing User Migration** - One-time adjustment for current users

## Mitigations

### For Adjustment Period

- First-run tooltip: "Sidebar is hidden. Press `Ctrl+K` to navigate or `Ctrl+B` to show sidebar."
- No data migration needed; new users get clean default

### For Discoverability

- `Ctrl+K` hint appears in empty states
- Help modal (`?` or `F1`) prominently accessible
- Onboarding checklist for new users

### For Support Inquiries

- FAQ: "How do I show the sidebar?"
- In-app hint system
- Clear documentation

## Alternatives Considered

### Alternative 1: Keep Sidebar Always Visible

**Rejected.** Conflicts with command-palette-first paradigm. Screen space wasted for keyboard users. Sends wrong signal about primary navigation method.

### Alternative 2: Auto-Hide Sidebar (Hover to Show)

**Rejected.** Auto-hide creates accidental triggers, inconsistent layout during animations, and accessibility issues. Fixed state (on or off) is clearer.

### Alternative 3: Collapsed Sidebar (Icons Only)

**Considered but rejected.** Icon-only sidebar still consumes ~50px width and provides little value over command palette. All-or-nothing approach is cleaner.

### Alternative 4: Per-Page Sidebar Visibility

**Rejected.** Inconsistent experience across pages creates confusion. Global setting is simpler and more predictable.

### Alternative 5: Sidebar on Right Side

**Rejected.** Doesn't address the core issue of sidebar being redundant with palette. Position change doesn't solve the problem.

## Implementation Notes

### Backend Changes

Add `SidebarVisible` field to `AppConfig`:

```go
type AppConfig struct {
    // ... existing fields
    SidebarVisible bool `json:"sidebar_visible"`
}
```

Default: `false`

Add service methods:
- `GetSidebarVisible() bool`
- `SetSidebarVisible(visible bool) error`

### Frontend Changes

1. Create `useSidebarSetting` hook for persisted state
2. Update `Layout.tsx` to use hook instead of local state
3. Add toggle to Settings > Appearance section
4. Add CSS transitions for smooth toggle animation
5. Add screen reader announcements for state changes

See [[sidebar-toggle]] for full implementation specifications.

### Migration for Existing Users

- Existing config files without `sidebar_visible` key get default `false`
- First launch after upgrade shows one-time tooltip
- No data migration needed

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Sidebar enablement rate | <30% of users | Settings analytics |
| Command palette usage | Increase by 40% | Usage analytics |
| "Where is sidebar?" support tickets | <10 per month after 30 days | Support tracking |
| User satisfaction (post-change) | No significant decrease | NPS/feedback |

## Rollback Plan

If user feedback is strongly negative:

1. **Quick fix:** Change default to `true` in patch release
2. **Medium-term:** Add first-run preference prompt
3. **Long-term:** A/B test different defaults with new users

## Related Decisions

- [[adr-001-command-palette-first]] - Establishes palette as primary navigation
- [[adr-003-command-line-fate]] - Simplifies command line to Quick Create

## References

- [[sidebar-toggle]] - Full design specification for sidebar settings
- [[mental-model]] - Core concepts and keyboard-first philosophy
- [[command-palette-design]] - Primary navigation interface specifications
- [[quick-access]] - Unified navigation hierarchy documentation
