# Product

## Register

product

## Users
Developers who live in the terminal and editor. They want a note-taking app that stays out of the way, feels as fast as native tools, and stores notes as plain files they own and can version-control. Used daily during focused work sessions — context switching is expensive and slowness is a dealbreaker.

## Product Purpose
Yanta is a keyboard-first, fast note-taking app for developers. Notes are plain JSON stored locally — no lock-in, no proprietary formats. Built with Go + Wails (no Electron), targeting Windows, macOS, and Linux. Success means: instant startup, sub-frame interactions, full keyboard operability, and notes that last forever.

## Brand Personality
Fast, trustworthy, surgical. No bloat, no noise — just the work. Feels like a sharp command-line tool that happens to have a beautiful editor.

## Anti-references
- Notion's marketing weight and visual complexity
- Obsidian's plugin-heavy configuration culture
- Roam's cult-academic aesthetic
- Any Electron-based app that feels like a browser
- Generic SaaS dashboards (hero metrics, gradient text, card grids)

## Design Principles
1. **Fast or it didn't ship** — every interaction must feel instantaneous; motion enhances, never delays
2. **Keyboard first, mouse friendly** — every action reachable without a mouse, discoverable with one
3. **The data is yours** — vault format stays open; UI never obscures the underlying files
4. **Polish is a feature** — empty states, spacing, focus affordances are product, not decoration
5. **One thing at a time** — clear focus hierarchy; the current document is the hero

## Accessibility & Inclusion
WCAG AA contrast minimum. Keyboard-complete navigation. `prefers-reduced-motion` respected — all animations have instant fallbacks. Focus rings visible and styled with design tokens.
