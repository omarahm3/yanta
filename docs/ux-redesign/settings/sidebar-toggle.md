---
type: architecture
title: Sidebar Toggle Settings
created: 2026-02-01
tags:
  - ux-redesign
  - settings
  - sidebar
related:
  - "[[mental-model]]"
  - "[[command-palette-design]]"
  - "[[adr-002-sidebar-optional]]"
  - "[[quick-access]]"
---

# Sidebar Toggle Settings

This document defines the settings approach for making the sidebar optional and hidden by default. It addresses the command-palette-first paradigm where the sidebar becomes a secondary navigation mechanism rather than the primary one.

---

## Design Philosophy

In a command-palette-first interface, the sidebar is **assistive, not essential**. Users who prefer visual navigation can enable it, but the default experience should be clean, minimal, and keyboard-driven. This aligns with the mental model defined in [[mental-model]]:

> **Keyboard Primacy**: Every concept can be accessed and manipulated via keyboard. Mouse is optional, never required.

---

## Current State Analysis

### Existing Implementation

| Aspect | Current State |
|--------|---------------|
| **Toggle Mechanism** | `Ctrl+B` (Windows/Linux), `Cmd+E` (macOS) |
| **Default Visibility** | Visible (`useState(true)`) |
| **Persistence** | Not persisted (resets on refresh) |
| **Settings Control** | None (hotkey only) |
| **Location** | `Layout.tsx` lines 83-107 |

### Code Reference

```typescript
// frontend/src/components/Layout.tsx:83
const [sidebarVisible, setSidebarVisible] = useState(true);
```

The sidebar visibility state is currently ephemeral - it resets to `true` every time the user refreshes or reopens the application.

---

## Proposed Setting: "Show Sidebar"

### Setting Definition

| Property | Value |
|----------|-------|
| **Name** | Show Sidebar |
| **Key** | `sidebarVisible` (frontend) / `sidebar_visible` (backend) |
| **Type** | Boolean |
| **Default** | `false` (off) |
| **Persistence** | Backend config file |
| **Scope** | Global (all pages) |

### User-Facing Description

> **Show Sidebar**
> Display the navigation sidebar on the left side of the screen. When hidden, use the command palette (`Ctrl+K`) or keyboard shortcuts for navigation.

### Setting Behavior

| State | Behavior |
|-------|----------|
| **Off (default)** | Sidebar hidden, main content spans full width |
| **On** | Sidebar visible, main content width reduced |

---

## Settings UI Placement

### Location: Appearance Section

The "Show Sidebar" setting belongs in the **Appearance** section because it affects the visual layout of the application. The Appearance section currently contains:

1. Interface Scale

After this change, it will contain:

1. **Show Sidebar** (new - placed first as it has higher visual impact)
2. Interface Scale

### Wireframe

```
┌──────────────────────────────────────────────────────────────────┐
│ Settings                                                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ APPEARANCE                                                        │
│ ─────────────────────────────────────────────────────────────────│
│                                                                   │
│ Show Sidebar                                              [═══○] │
│ Display the navigation sidebar. Use Ctrl+B to toggle.            │
│                                                                   │
│ ─────────────────────────────────────────────────────────────────│
│                                                                   │
│ Interface Scale                                                   │
│ [  75%  ] [  90%  ] [ 100% ] [ 110% ] [ 125% ] [ 150% ] [ 200% ] │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Component Structure

```typescript
// In AppearanceSection.tsx

<SettingsSection title="Appearance">
  <SettingsRow
    label="Show Sidebar"
    description="Display the navigation sidebar. Use Ctrl+B to toggle."
  >
    <Switch
      checked={sidebarVisible}
      onCheckedChange={handleSidebarToggle}
      aria-label="Show Sidebar"
    />
  </SettingsRow>

  {/* Existing Interface Scale controls */}
</SettingsSection>
```

---

## Keyboard Shortcut: `Ctrl+B`

### Current Binding

The `Ctrl+B` shortcut already exists and toggles sidebar visibility. This design proposes **no changes** to the shortcut itself, only to the persistence behavior.

| Platform | Shortcut | Status |
|----------|----------|--------|
| Windows/Linux | `Ctrl+B` | Keep (primary) |
| macOS | `Cmd+E` | Keep (secondary) |

### Shortcut Behavior Enhancement

Currently, the shortcut only toggles the local React state. After this change:

1. Shortcut toggles sidebar visibility
2. New visibility state is **persisted to backend**
3. State survives page refresh and app restart

### Command Palette Integration

The command palette already includes a "Toggle Sidebar" command (see [[command-palette-design]]):

| ID | Text | Icon | Shortcut |
|----|------|------|----------|
| `toggle-sidebar` | Toggle Sidebar | `PanelLeft` | `Ctrl+B` |

This command should use the same handler as the settings toggle, ensuring consistency.

---

## Transition Experience

### Animation Specification

When toggling the sidebar, the transition should be smooth and non-jarring.

#### CSS Transition Properties

```css
.layout-container {
  transition: padding-left 200ms ease-out;
}

.sidebar {
  transition:
    transform 200ms ease-out,
    opacity 150ms ease-out;
}

/* Hidden state */
.sidebar[data-visible="false"] {
  transform: translateX(-100%);
  opacity: 0;
  pointer-events: none;
}

/* Visible state */
.sidebar[data-visible="true"] {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}
```

#### Timing

| Phase | Duration | Easing |
|-------|----------|--------|
| Sidebar slide out | 200ms | ease-out |
| Sidebar fade | 150ms | ease-out |
| Content expand | 200ms | ease-out |

### Visual Sequence: Hiding Sidebar

```
┌────────────────────────────────────────────────────────────────────┐
│ Step 1: Initial State (Sidebar Visible)                            │
├────────────────────────────────────────────────────────────────────┤
│ ┌──────────┬─────────────────────────────────────────────────────┐ │
│ │ Sidebar  │                    Main Content                      │ │
│ │          │                                                      │ │
│ │ NAVIGATION│                                                     │ │
│ │ Dashboard │                                                     │ │
│ │ Projects  │                                                     │ │
│ │ Search    │                                                     │ │
│ │ Journal   │                                                     │ │
│ │          │                                                      │ │
│ └──────────┴─────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ Step 2: Transition (200ms)                                         │
├────────────────────────────────────────────────────────────────────┤
│ ┌──────┬─────────────────────────────────────────────────────────┐ │
│ │ ◀──  │                     Main Content                         │ │
│ │ fade │              (expanding to fill space)                   │ │
│ │      │                                                          │ │
│ └──────┴─────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ Step 3: Final State (Sidebar Hidden)                               │
├────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │                                                                 │ │
│ │                        Main Content                             │ │
│ │                    (full width display)                         │ │
│ │                                                                 │ │
│ │                                                                 │ │
│ │                                                                 │ │
│ └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### Visual Sequence: Showing Sidebar

The reverse animation plays when showing the sidebar:

1. Main content contracts from left edge
2. Sidebar slides in from left with fade-in
3. Focus remains on current element (no focus shift)

---

## Layout Changes When Sidebar is Hidden

### Content Width Adjustment

| Sidebar State | Main Content Width | Padding Left |
|---------------|-------------------|--------------|
| Visible | `calc(100% - 192px)` | `192px` (sidebar width) |
| Hidden | `100%` | `0` |

### Layout Component Changes

```typescript
// Layout.tsx - Proposed changes

interface LayoutProps {
  // ... existing props
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  // Replace useState(true) with persisted setting
  const { sidebarVisible, setSidebarVisible } = useSidebarSetting();

  return (
    <div
      className={cn(
        "layout-container",
        sidebarVisible ? "pl-48" : "pl-0"
      )}
      data-sidebar-visible={sidebarVisible}
    >
      {sidebarVisible && (
        <aside className="sidebar">
          <Sidebar sections={sidebarSections} />
        </aside>
      )}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};
```

### Focus Management

When the sidebar is hidden:

1. **Focus should NOT shift** - User's current focus remains unchanged
2. **Tab order excludes sidebar** - Sidebar elements removed from tab sequence
3. **Keyboard shortcuts still work** - `Ctrl+B` toggles sidebar even when hidden

When the sidebar is shown:

1. **Focus should NOT shift** - User continues working in main content
2. **Sidebar becomes tabbable** - Added back to tab sequence
3. **No automatic focus on sidebar** - User must explicitly navigate there

### Screen Reader Announcements

| Action | Announcement |
|--------|--------------|
| Hide sidebar | "Sidebar hidden. Press Ctrl+B to show." |
| Show sidebar | "Sidebar shown." |

Implementation:

```typescript
const handleSidebarToggle = (visible: boolean) => {
  setSidebarVisible(visible);

  // Announce state change for screen readers
  const message = visible
    ? "Sidebar shown."
    : "Sidebar hidden. Press Ctrl+B to show.";
  announceForScreenReaders(message);
};
```

---

## Responsive Behavior

### Breakpoint Considerations

On smaller screens, the sidebar may already be hidden or collapsed. The setting should interact gracefully with responsive behavior:

| Screen Width | Sidebar Setting | Actual Behavior |
|--------------|-----------------|-----------------|
| > 1024px | On | Visible |
| > 1024px | Off | Hidden |
| < 1024px | On | Collapsed/Overlay |
| < 1024px | Off | Hidden |

### Mobile Considerations

On mobile viewports (< 768px), the sidebar should always be hidden by default, regardless of the setting. The setting controls desktop behavior only.

---

## Backend Integration

### New Config Field

Add to the existing config structure:

```go
// internal/config/config.go

type AppConfig struct {
    // ... existing fields
    SidebarVisible bool `json:"sidebar_visible"`
}
```

Default value: `false`

### New Service Methods

```go
// internal/system/service.go

func (s *Service) GetSidebarVisible() bool {
    return s.config.SidebarVisible
}

func (s *Service) SetSidebarVisible(visible bool) error {
    s.config.SidebarVisible = visible
    return s.saveConfig()
}
```

### Frontend Bindings

After Wails binding regeneration:

```typescript
// frontend/bindings/yanta/internal/system/service.ts

export function GetSidebarVisible(): Promise<boolean>;
export function SetSidebarVisible(visible: boolean): Promise<void>;
```

---

## State Management Hook

Create a dedicated hook for sidebar visibility:

```typescript
// frontend/src/hooks/useSidebarSetting.ts

import { useEffect, useState, useCallback } from 'react';
import { GetSidebarVisible, SetSidebarVisible } from '@bindings/system/service';

export function useSidebarSetting() {
  const [sidebarVisible, setSidebarVisibleState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load persisted setting on mount
    GetSidebarVisible()
      .then((visible) => {
        setSidebarVisibleState(visible);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load sidebar setting:', err);
        setIsLoading(false);
      });
  }, []);

  const setSidebarVisible = useCallback(async (visible: boolean) => {
    setSidebarVisibleState(visible);
    try {
      await SetSidebarVisible(visible);
    } catch (err) {
      console.error('Failed to save sidebar setting:', err);
      // Revert on error
      setSidebarVisibleState(!visible);
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarVisible(!sidebarVisible);
  }, [sidebarVisible, setSidebarVisible]);

  return {
    sidebarVisible,
    setSidebarVisible,
    toggleSidebar,
    isLoading,
  };
}
```

---

## Implementation Checklist

### Backend Changes
- [ ] Add `SidebarVisible` field to `AppConfig` struct
- [ ] Set default value to `false`
- [ ] Implement `GetSidebarVisible()` method
- [ ] Implement `SetSidebarVisible()` method
- [ ] Regenerate Wails bindings

### Frontend Changes
- [ ] Create `useSidebarSetting` hook
- [ ] Update `Layout.tsx` to use persisted setting
- [ ] Add sidebar toggle to `AppearanceSection.tsx`
- [ ] Add CSS transitions for smooth toggle
- [ ] Add screen reader announcements
- [ ] Update command palette handler to use same state

### Testing
- [ ] Verify default state is hidden
- [ ] Verify toggle persists across page refresh
- [ ] Verify toggle persists across app restart
- [ ] Verify keyboard shortcut works in both states
- [ ] Verify command palette command works
- [ ] Verify settings UI reflects current state
- [ ] Verify animation is smooth
- [ ] Test with screen reader

---

## Migration Considerations

### Existing Users

Users upgrading to the new version will experience a change: their sidebar will be hidden by default. To ease this transition:

1. **First-run detection**: On first launch after upgrade, show a brief tooltip:
   > "Sidebar is now hidden by default. Press Ctrl+B or use Settings to show it."

2. **No data migration needed**: The new setting has a default value, so existing config files work without modification.

### Rollback Plan

If users report significant friction:

1. Change default to `true` in a patch release
2. Document the keyboard shortcut prominently
3. Consider a first-run onboarding flow for sidebar preference

---

## Related Documentation

- [[mental-model]] - Core concepts and keyboard-first philosophy
- [[command-palette-design]] - Toggle Sidebar command definition
- [[adr-002-sidebar-optional]] - Architecture decision record for sidebar-off-by-default
- [[quick-access]] - Unified navigation hierarchy
