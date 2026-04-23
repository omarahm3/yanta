/**
 * Historical: this hook manually repositioned BlockNote menus (table/row/block
 * drag handle popovers) because an earlier layout had a CSS `transform` in the
 * ancestor chain that broke Radix Popper's containing-block assumptions.
 *
 * That transform is gone (the scale system now uses `font-size: calc(...)`
 * rather than `transform: scale(...)`), so Radix's own Floating UI positioning
 * is correct on its own. The manual override was fighting Radix and pushing
 * menus hundreds of pixels off their triggers (see issues.md #14).
 *
 * Kept as a no-op for now so any call sites don't need to change. If a future
 * change reintroduces a transformed ancestor and menus drift again, the fix
 * is to remove the transform — not to resurrect manual positioning.
 */
export function useBlockNoteMenuPosition(): void {
	// no-op
}
