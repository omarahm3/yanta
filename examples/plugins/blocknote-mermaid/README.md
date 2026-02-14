# BlockNote Mermaid Plugin Example

Reference package:

- https://github.com/defensestation/blocknote-mermaid

This example shows how to integrate a third-party BlockNote extension into YANTA.

## What It Adds

1. Mermaid block spec
2. Mermaid slash menu item

## Files

- `plugin.ts` - integration code (`setup(api)`)
- `plugin.toml` - manifest (`entry = "main.js"`)
- `package.json` - plugin-local build config

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
4. Select this folder (`examples/plugins/blocknote-mermaid`).
5. Enable plugin toggle.

## Verify

1. Open a document.
2. Type `/`.
3. Choose Mermaid slash action.
4. Insert Mermaid block.

## Notes

- YANTA does not install Mermaid package dependencies.
- The plugin folder must already contain built `main.js`.
