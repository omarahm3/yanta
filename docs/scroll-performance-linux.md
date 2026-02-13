# Scroll Performance Issue on Linux (NVIDIA + Wayland)

## Status: Mitigation Applied on Branch (Needs Runtime Validation)

## Branch Update (2026-02-13)

The originally proposed fixes are now applied in code:

- Frontend:
  - `frontend/src/shared/ui/SettingsSection.tsx` now uses opaque surfaces (no `backdrop-blur`).
  - `frontend/src/search/SearchPage.tsx` search input/cards now use opaque surfaces; result cards no longer use `transition-all`; hover `onMouseEnter` selection updates removed.
  - `frontend/src/settings/hooks/useSettingsPage.ts` replaced `currentSectionIndex` React state with `useRef` to avoid extra Settings page re-renders during section navigation hotkeys.
- Backend:
  - `internal/app/graphics.go` no longer forces `WEBKIT_DISABLE_COMPOSITING_MODE=1` / `GSK_RENDERER=cairo` for NVIDIA + Wayland.
  - `main.go` now always uses `WebviewGpuPolicyOnDemand`.
  - Safety env remains: `WEBKIT_DISABLE_DMABUF_RENDERER=1`.

Expected result: scroll FPS on Settings/Search should improve substantially on Linux NVIDIA Wayland.  
Remaining risk: GPU compositing regressions (artifacts/crashes) on some driver/compositor combinations.

## Follow-up Update (2026-02-13, v2)

Additional mitigations applied:

- **Graphics mode override in preferences** (`preferences.graphics.linux_mode`):
  - `auto` (default, native-first with startup-failure fallback)
  - `native`
  - `compat`
  - `software`
- **Auto fallback behavior**:
  - On Linux `auto`, if previous startup did not complete, app falls back to `compat` and sets a sticky fallback flag.
  - Successful native startup clears fallback flag.
- **Global reduced-effects performance gate**:
  - When `data-reduced-effects="true"`, app now disables expensive animations/transitions/shadows/filters globally and forces opaque glass surfaces.
- **Settings hardening**:
  - Shortcut reference table is collapsible and defaults to collapsed when reduced effects are enabled.
  - Select/switch transitions were narrowed from `transition-all` to cheaper transitions.

## Environment

- **OS**: CachyOS (Arch-based rolling release)
- **Kernel**: 6.18.7-2-cachyos
- **CPU**: Intel Core i9-14900HX
- **GPU**: NVIDIA GeForce RTX 4090 Laptop (AD103M) + Intel UHD (iGPU)
- **RAM**: 32 GB
- **Session**: Wayland (Hyprland compositor)
- **WebKitGTK**: 2.50.4
- **NVIDIA Driver**: 590.48.01

## Problem

Mouse wheel scrolling on the **Settings** and **Search** pages runs at ~6-9 FPS. Keyboard navigation (j/k) is noticeably smoother. The **Documents** page scrolls fine.

Not reproducible on Windows 11 (WebView2/Chromium backend).

## Root Cause Analysis

Two factors combine to cause this:

### 1. Forced Software Rendering

`internal/app/graphics.go` detects NVIDIA + Wayland and applies:
- `WEBKIT_DISABLE_COMPOSITING_MODE=1` (disables GPU compositing)
- `GSK_RENDERER=cairo` (forces CPU-only Cairo renderer)
- `WebviewGpuPolicyNever` in `main.go` (disables WebView GPU use)

This puts the entire rendering pipeline on the CPU.

### 2. Dense Backdrop-Blur on Scrollable Content

Settings page has 8 `SettingsSection` cards (3-4 visible at once), each with:
```
bg-glass-bg/20 backdrop-blur-md border border-glass-border rounded-xl shadow-sm
```

Search page has similar per-result-card glass effects.

The Documents page works fine because its list items have **no** `backdrop-blur` — blur is only on the static layout frame (sidebar, header).

In software rendering mode, each scrolling `backdrop-blur-md` element requires full CPU recomposition per frame. With 3-4 visible simultaneously, the CPU can't keep up.

## Attempted Fixes (What Didn't Work)

- Global `* { backdrop-filter: none !important }` — still 6-9 FPS (software rendering bottleneck persists even without blur; shadows, rounded corners, and semi-transparent layers are also expensive in Cairo)
- `content-visibility: auto` / `contain: content` / `will-change: scroll-position` — no effect
- React re-render elimination (useRef instead of useState) — confirmed renders stay stable at 3 during scroll, not a React problem

## Proposed Fix (Not Yet Applied)

### Backend: Re-enable GPU compositing
- Remove `WEBKIT_DISABLE_COMPOSITING_MODE=1` and `GSK_RENDERER=cairo` from `configureNVIDIAWaylandFix()`
- Change `getOptimalGpuPolicy()` to always return `WebviewGpuPolicyOnDemand`
- Keep `WEBKIT_DISABLE_DMABUF_RENDERER=1` as a safety net

**Risk**: NVIDIA + Wayland + WebKitGTK GPU compositing may cause crashes or artifacts on some driver versions. Needs testing.

### Frontend: Remove backdrop-blur from scrollable cards
- `SettingsSection.tsx`: replace `bg-glass-bg/20 backdrop-blur-md ... shadow-sm` with opaque `bg-surface/80`
- `Search.tsx` result cards: same treatment
- Keep `backdrop-blur` on static layout elements (sidebar, header) — those don't scroll

### Frontend: React-level improvements (valid regardless)
- `Settings.tsx`: `currentSectionIndex` state -> useRef (prevents callback cascade)
- `Search.tsx`: `selectedIndexRef` to avoid stale closures, remove `onMouseEnter` (prevents state updates during scroll), targeted CSS transitions instead of `transition-all`
