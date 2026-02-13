# Yanta Pending Tasks

Last updated: 2026-02-13

## Plugin Architecture (Item 17)
- Implement plugin installation and uninstall flows beyond local directory discovery and enabled-state toggles.
- Add first-class plugin management UI in Settings:
  - List installed plugins
  - Install and uninstall
  - Enable and disable
  - Error states and recovery
- Finalize plugin API versioning and compatibility policy.
- Improve manifest validation and plugin error reporting UX.
- Decide and implement stronger plugin isolation model if required.
- Expand editor plugin interface for richer block and tooling contributions with clear lifecycle hooks.

## Tier 6 Platform Work (53a–53d)
- 53a: Implement full runtime theme system with token architecture and support for user-created themes.
- 53b: Complete plugin platform hardening:
  - Sandboxing and trust model
  - Packaging model suitable for marketplace distribution
- 53c: Build marketplace flows for themes/plugins:
  - Browse
  - Install
  - Update
  - Remove
- 53d: Implement i18n foundation:
  - String extraction
  - Locale loading
  - Runtime language switching support
- Integrate configuration, hotkeys, and state layers for plugin-driven extensibility end-to-end.

## Linux Scroll Performance Follow-up
- Run runtime validation on Linux NVIDIA Wayland across graphics modes (`auto`, `native`, `compat`, `software`).
- Verify no regressions in:
  - Scroll FPS in Settings/Search
  - Startup stability (native-first with fallback behavior)
  - Rendering artifacts/crashes under GPU compositing
- If regressions appear, tune defaults and document safe mode recommendations per compositor/driver.
