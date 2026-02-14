# YANTA Plugin Examples

These examples follow YANTA’s simple plugin model:

1. plugin author builds plugin to `main.js`
2. user installs plugin folder in YANTA
3. user enables plugin (with Community Plugins enabled)

## Folders

- `generic-editor-extension/`
  - generic starter for TipTap/BlockNote style integration
- `blocknote-mermaid/`
  - concrete BlockNote Mermaid adapter example

## Requirements

- Node + npm (for building plugin examples)
- YANTA Plugins feature enabled
- `examples/plugins/plugin-policy.md`

## Shared Workflow

For either example:

```bash
cd examples/plugins/<plugin-folder>
npm install
npm run build
```

Then in YANTA:

1. `Settings -> Plugins`
2. Enable `Community Plugins`
3. `Install Plugin` and select that plugin folder
4. Enable plugin toggle

## Entrypoint Contract

Plugin runtime entrypoint must export `setup(api)`:

```ts
export function setup(api) {
  // register commands/extensions/hooks
}

export default { setup };
```

## Common Issues

- `PLUGIN_INVALID_MANIFEST`:
  - check required manifest fields
  - ensure `entry = "main.js"`
- `PLUGIN_INCOMPATIBLE_API`:
  - align `api_version` major with `SupportedPluginAPIMajor`
- Plugin installed but not running:
  - enable `Community Plugins`
  - enable plugin toggle

## Important Notes

- YANTA does not install plugin dependencies.
- YANTA does not run plugin build tools.
- Plugin folder must include `plugin.toml` and `main.js`.
