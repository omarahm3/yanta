# Wails 3 Frontend Runtime Review

**Date**: 2026-02-04
**Source**: https://v3alpha.wails.io/reference/frontend-runtime/
**Package**: `@wailsio/runtime`

---

## Version Status

| | Current | Latest Available |
|---|---|---|
| **Installed** | `3.0.0-alpha.73` | `3.0.0-alpha.79` |
| **package.json** | `^3.0.0-alpha.73` | — |

**Action Required**: The project is 6 alpha versions behind. Run `npm update @wailsio/runtime` in `frontend/` to pull `3.0.0-alpha.79` (the caret range will resolve it automatically).

---

## Import Style

**Current**: All 12 files use barrel imports from `@wailsio/runtime`:
```typescript
import { Events } from "@wailsio/runtime";
import { System, Window } from "@wailsio/runtime";
import { Browser } from "@wailsio/runtime";
import { Dialogs, Events } from "@wailsio/runtime";
```

**Recommended by docs**: Modular sub-path imports for tree-shaking:
```typescript
import { On, Emit } from "@wailsio/runtime/events";
import Window from "@wailsio/runtime/window";
import { SetText, Text } from "@wailsio/runtime/clipboard";
import { OpenURL } from "@wailsio/runtime/browser";
```

**Impact**: Barrel imports pull in the entire runtime. Modular imports allow Vite to tree-shake unused modules, reducing bundle size. Since the app only uses Events, Window, System, Browser, and Dialogs — switching to modular imports would exclude unused modules (Clipboard, Screens, Application, etc.).

**Files to update**:
- `src/App.tsx` — `Events` → `import { On } from "@wailsio/runtime/events"`
- `src/contexts/DocumentContext.tsx` — same
- `src/contexts/DocumentCountContext.tsx` — same
- `src/contexts/ProjectContext.tsx` — same
- `src/pages/document/useDocumentController.ts` — `Dialogs, Events`
- `src/pages/Journal/useJournal.ts` — `Events`
- `src/pages/settings/useSettingsController.ts` — `Events`
- `src/pages/QuickCapture/QuickCapture.tsx` — `Window`
- `src/components/ui/TitleBar.tsx` — `System, Window`
- `src/components/ui/ResizeHandles.tsx` — `System, Window`
- `src/components/editor/RichEditor.tsx` — `Browser, System`
- `src/extensions/link-toolbar/index.tsx` — `Browser`

---

## Missing Side-Effect Import

The docs state:
> Even if you don't use the API, make sure to include a side-effect import statement somewhere in your frontend code: `import "@wailsio/runtime";`

**Status**: No side-effect import found in the codebase. The barrel imports (`import { Events } from "@wailsio/runtime"`) likely trigger the runtime initialization as a side effect, but this is not guaranteed after switching to modular imports.

**Action**: Add `import "@wailsio/runtime";` in the app entry point (e.g., `src/main.tsx`) to ensure context menus and window dragging initialization code is always included.

---

## Missing Vite Plugin

The docs recommend adding the Wails Vite plugin for HMR support with typed events:
```typescript
import wails from "@wailsio/runtime/plugins/vite";
export default defineConfig({
  plugins: [wails()],
});
```

**Current `vite.config.ts`**: Does NOT include the Wails Vite plugin. Only has `react()`, `tailwindcss()`, and `visualizer()`.

**Impact**: Without the plugin, event bindings are not automatically reloaded during `wails3 dev` when `wails3 generate bindings` is run. Developers must manually restart the dev server to pick up binding changes.

**Action**: Add `wails()` to the plugins array in `vite.config.ts`.

---

## Typed Events Not Used

The docs support typed event registration with `application.RegisterEvent[T]()` in Go and typed event imports in the frontend:
```typescript
import { UserUpdated } from "./bindings/events";
Events.Emit(UserUpdated({ ID: "123", Name: "John Doe" }));
```

**Current**: The project uses plain string-based event names everywhere:
```typescript
Events.On("yanta/entry/created", () => { ... });
Events.On("yanta/project/changed", (ev) => { ... });
```

Go backend defines events as string constants in `internal/events/events.go` but does NOT use `application.RegisterEvent[T]()`.

**Impact**: No compile-time type safety on event names or payloads. Typos in event strings cause silent failures. Event payload types (documented in comments like `// payload: {id, projectId, title}`) are not enforced.

**Recommendation**: This is a larger refactor. Consider incrementally adopting typed events for high-traffic events first (`EntryCreated`, `EntryUpdated`, `ProjectChanged`).

---

## API Usage Observations

### Window API

| Usage in Code | Documented API | Status |
|---|---|---|
| `Window.Minimise()` | `Window.Minimise()` | Correct |
| `Window.ToggleMaximise()` | Not in docs (docs show `Maximise()`) | May be valid but undocumented |
| `Window.Close()` | `Window.Close()` | Correct |
| `Window.SetPosition(x, y)` | `Window.SetPosition(x, y)` | Correct |
| `Window.SetSize(w, h)` | `Window.SetSize(w, h)` | Correct |
| `Window.Position()` | `Window.Position()` | Correct |
| `Window.Width()` | Not in docs (docs show `Window.Size()`) | Potentially non-standard |
| `Window.Height()` | Not in docs (docs show `Window.Size()`) | Potentially non-standard |

**Issue in `ResizeHandles.tsx:159-160`**:
```typescript
const width = await Window.Width();
const height = await Window.Height();
```
The documented API is `Window.Size()` which returns `{ width, height }`. `Window.Width()` and `Window.Height()` may be convenience methods that exist in the package but are not part of the documented API. Verify these exist in the installed version or migrate to:
```typescript
const { width, height } = await Window.Size();
```

### System API

`System.IsLinux()` is used in `TitleBar.tsx` and `ResizeHandles.tsx`. This is not documented in the frontend runtime reference but may be available in the package. Verify it exists.

### Browser API

`Browser.OpenURL()` is used in `RichEditor.tsx` and `link-toolbar/index.tsx`. The docs show:
```typescript
import { OpenURL } from "@wailsio/runtime/browser";
```
The current barrel import `import { Browser } from "@wailsio/runtime"` and usage as `Browser.OpenURL()` works but is the non-modular pattern.

### Dialog API

`Dialogs.SaveFile()` is used in `useDocumentController.ts`. The docs show:
```typescript
import { SaveFile } from "@wailsio/runtime/dialogs";
```

### Events API

All event subscriptions properly use `Events.On()` and return unsubscribe functions that are called in `useEffect` cleanup — this follows React best practices and the Wails docs' recommendation to "Unsubscribe events - Clean up when done".

---

## Event Cleanup Patterns

All contexts and hooks properly unsubscribe from events in `useEffect` cleanup:

```typescript
// DocumentContext.tsx - Correct pattern
useEffect(() => {
  const unsubscribeCreated = Events.On("yanta/entry/created", () => { ... });
  const unsubscribeUpdated = Events.On("yanta/entry/updated", () => { ... });
  return () => {
    unsubscribeCreated();
    unsubscribeUpdated();
  };
}, [refreshDocuments]);
```

**Status**: All 7 files with `Events.On()` properly handle cleanup. No event listener leaks detected.

---

## WML Usage

The docs describe WML declarative attributes (`wml-event`, `wml-window`, `wml-openurl`, etc.) as a simpler alternative for common actions.

**Current**: The project does NOT use WML attributes. All window operations and events are handled via JavaScript/React handlers. The only Wails-specific HTML attributes are CSS custom properties for drag:
```tsx
style={{ "--wails-draggable": "drag" } as React.CSSProperties}
```

**Assessment**: This is fine. WML is optional and the React-based approach provides more control and type safety. No action needed.

---

## Summary of Action Items

| Priority | Item | Effort |
|---|---|---|
| **High** | Update `@wailsio/runtime` to `3.0.0-alpha.79` | Low |
| **High** | Add side-effect import `import "@wailsio/runtime"` in entry point | Low |
| **Medium** | Add Wails Vite plugin to `vite.config.ts` | Low |
| **Medium** | Switch to modular sub-path imports for tree-shaking | Medium |
| **Medium** | Verify `Window.Width()` / `Window.Height()` exist or migrate to `Window.Size()` | Low |
| **Low** | Adopt typed events with `application.RegisterEvent[T]()` | High |
| **Low** | Verify `System.IsLinux()` is a supported API | Low |
