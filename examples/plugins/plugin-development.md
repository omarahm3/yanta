# Develop, Build, and Ship a YANTA Plugin

Last updated: 2026-02-15

This guide is for plugin developers. It is the single source of truth for writing and shipping external YANTA plugins.

## 1) Plugin Runtime Model

YANTA uses a prebuilt plugin model:

1. You own dependencies and build tooling inside your plugin project.
2. You ship built artifacts.
3. YANTA installs and executes built output only.

YANTA does not install your npm dependencies and does not run your plugin build for you.

## 2) Quick Start (Recommended)

1. Copy `examples/plugins/generic-editor-extension` to a new folder.
2. Update `plugin.toml` metadata (`id`, `name`, `version`).
3. Replace sample `plugin.ts` contributions with your own.
4. Run:

```bash
npm install
npm run build
```

5. Install folder in YANTA via `Settings -> Plugins -> Install Plugin`.

## 3) Required Files

Source-time:

1. `plugin.toml`
2. `plugin.ts` (or your source entrypoint)
3. `package.json`

Build output required by YANTA:

1. `main.js`
2. `main.meta.json`

## 4) Manifest Contract (`plugin.toml`)

Example:

```toml
id = "acme.my-plugin"
name = "Acme My Plugin"
version = "1.0.0"
api_version = "1"
entry = "main.js"
capabilities = ["commands", "editorExtensions"]
```

`api_version` must match YANTA plugin API major.

## 5) Plugin Entrypoint Contract

Your built module must export `setup(api)`:

```ts
export function setup(api) {
  // register commands/extensions/hooks
}

export default { setup };
```

## 6) Build Pipeline (Bun + Auto Metadata)

Use `yanta-plugin build` via your `package.json` script.

If your plugin lives inside this repo examples folder:

```json
{
  "scripts": {
    "build": "go run ../../../cmd/yanta-plugin build -plugin . -entry plugin.ts -out main.js -meta main.meta.json"
  }
}
```

If your plugin lives in its own repo/environment:

```json
{
  "scripts": {
    "build": "yanta-plugin build -plugin . -entry plugin.ts -out main.js -meta main.meta.json"
  }
}
```

What this build does:

1. Bundles with Bun.
2. Externalizes host runtime packages.
3. Generates `main.meta.json`.
4. Computes entry hash automatically.

Do not hand-edit `main.meta.json`.

## 7) Editor Extension Compatibility (Important)

If your plugin uses TipTap or BlockNote extension APIs, your extension code must be compatible with YANTA’s editor runtime versions.

Practical rule:

1. Align your plugin’s editor package versions with YANTA runtime expectations.
2. Validate on a real YANTA build before shipping.

If an external package is built for older BlockNote/TipTap internals, it can fail at runtime and YANTA will isolate it.

## 8) Host Runtime Rules

These are host-provided and must not be bundled into plugin output:

- `react`
- `react-dom`
- `@blocknote/core`
- `@blocknote/react`
- `yjs`

Source imports are fine. Bundling them into `main.js` is rejected.

## 9) Install and Verify

1. Open `Settings -> Plugins`.
2. Enable `Community Plugins`.
3. Install your plugin folder.
4. Enable plugin toggle.
5. Verify commands/editor contributions in app.

## 10) Ship Format

Ship a folder (or zip) containing:

1. `plugin.toml`
2. `main.js`
3. `main.meta.json`
4. Any runtime assets your plugin needs

## 11) Validation Errors

- `PLUGIN_INVALID_MANIFEST`: invalid `plugin.toml`
- `PLUGIN_INCOMPATIBLE_API`: `api_version` major mismatch
- `PLUGIN_BUILD_METADATA_MISSING`: missing `main.meta.json`
- `PLUGIN_BUILD_METADATA_INVALID`: bad metadata format/content
- `PLUGIN_BUILD_HASH_MISMATCH`: metadata hash does not match `main.js`
- `PLUGIN_FORBIDDEN_BUNDLE`: bundled host runtime package found

## 12) Release Checklist

1. `npm run build` succeeds.
2. Manifest fields are correct.
3. `main.js` and `main.meta.json` are present.
4. Plugin installs/enables cleanly in YANTA.
5. Core plugin flows are tested in YANTA (commands, editor hooks, slash actions, cleanup).
