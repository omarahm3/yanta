# Plugin Platform Policy

Last updated: 2026-02-14

## 1) Core Model (Obsidian-Style)

YANTA plugin runtime is intentionally simple:

1. Plugin author builds plugin ahead of time.
2. User installs plugin from a folder.
3. YANTA loads prebuilt runtime file and executes plugin API.

YANTA does not install plugin dependencies, run bundlers, or manage plugin toolchains.

## 2) Plugin Artifact Contract

Required plugin files:

1. `plugin.toml`
2. `main.js`

Manifest rules:

- `entry` is required and must be `"main.js"`.
- `api_version` major must match YANTA supported major.

## 3) API Compatibility Policy

Single source of truth:

- `SupportedPluginAPIMajor` in `internal/plugins/version.go`

Current supported major: `1`

Accepted examples:

- `"1"`
- `"1.0.0"`

Rejected examples:

- `"2"`
- `"0.9.0"`
- non-numeric majors

## 4) Restricted Mode Policy

Community plugins are behind a global gate:

- `community_enabled = false` (default):
  - external plugin execution is disabled
- `community_enabled = true`:
  - per-plugin enabled toggles control activation

This mirrors the “community plugins off by default” safety model.

## 5) Runtime Loading Contract

External plugin loading path:

1. List installed plugins (`ListInstalled`)
2. Read plugin entry (`ReadPluginEntrypoint`)
3. Import module in frontend runtime
4. Execute exported `setup(api)`

Expected module exports:

```ts
export function setup(api) {}
export default { setup };
```

## 6) Error Policy

Install/validation errors:

- `PLUGIN_INVALID_MANIFEST`
- `PLUGIN_INCOMPATIBLE_API`
- `PLUGIN_ALREADY_INSTALLED`
- `PLUGIN_BAD_SOURCE`

Runtime safety errors:

- `PLUGIN_SANDBOX_RESTRICTED` (for restricted mode / non-executable states)
- `PLUGIN_NOT_OPERATIONAL`

## 7) Editor Contribution Contract

Plugins may contribute via:

- `registerEditorExtensions(...)`
- `registerEditorTipTapExtensions(...)`
- `registerEditorBlockSpecs(...)`
- `registerEditorStyleSpecs(...)`
- `registerEditorSlashMenuItems(...)`
- `registerEditorTools(...)`
- `registerEditorBlockActions(...)`
- `registerEditorLifecycleHooks(...)`
