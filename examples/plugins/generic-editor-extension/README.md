# Generic Editor Extension Plugin Example

Starter template for external YANTA plugins.

## What This Example Shows

- command contribution
- TipTap extension contribution
- BlockNote extension contribution
- slash menu contribution
- lifecycle hooks

## Files

- `plugin.ts` - plugin code
- `plugin.toml` - manifest
- `package.json` - build config for this plugin

## Manifest

Current values:

- `id = "example.generic-editor-extension"`
- `api_version = "1"`
- `entry = "main.js"`

## Build

From this folder:

```bash
npm install
npm run build
```

Output:

- `main.js`

## Install in YANTA

1. Open `Settings -> Plugins`.
2. Enable `Community Plugins`.
3. Click `Install Plugin`.
4. Select this folder (`examples/plugins/generic-editor-extension`).
5. Enable the plugin.

## Validate

1. Open command palette and run `Plugin: Generic Editor Extension`.
2. In editor type `/` and run `Insert Example Marker`.

## Adapting for Real Plugins

1. Replace sample extension code with your own extension package code.
2. Keep plugin entry output as `main.js`.
3. Keep `setup(api)` export contract.
