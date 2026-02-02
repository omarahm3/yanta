/**
 * Accessibility utilities for screen reader support
 */

// Keep a reference to a persistent live region to avoid creating multiple
let liveRegion: HTMLElement | null = null;

/**
 * Resets the internal live region state. Used for testing purposes.
 */
export function _resetLiveRegion(): void {
	if (liveRegion && liveRegion.parentNode) {
		liveRegion.parentNode.removeChild(liveRegion);
	}
	liveRegion = null;
}

/**
 * Announces a message to screen readers using an aria-live region.
 *
 * Creates a visually hidden element with aria-live="polite" that screen readers
 * will announce. The message is cleared after a short delay to allow for
 * subsequent announcements.
 *
 * @param message - The message to announce to screen readers
 * @param politeness - The aria-live politeness level ("polite" or "assertive")
 */
export function announceForScreenReaders(
	message: string,
	politeness: "polite" | "assertive" = "polite"
): void {
	// Create the live region if it doesn't exist
	if (!liveRegion) {
		liveRegion = document.createElement("div");
		liveRegion.setAttribute("role", "status");
		liveRegion.setAttribute("aria-live", politeness);
		liveRegion.setAttribute("aria-atomic", "true");
		// Visually hidden but accessible to screen readers
		Object.assign(liveRegion.style, {
			position: "absolute",
			width: "1px",
			height: "1px",
			padding: "0",
			margin: "-1px",
			overflow: "hidden",
			clip: "rect(0, 0, 0, 0)",
			whiteSpace: "nowrap",
			border: "0",
		});
		document.body.appendChild(liveRegion);
	}

	// Update the politeness if it changed
	liveRegion.setAttribute("aria-live", politeness);

	// Clear then set the message (this triggers the announcement)
	liveRegion.textContent = "";

	// Use requestAnimationFrame to ensure the DOM update is processed
	requestAnimationFrame(() => {
		if (liveRegion) {
			liveRegion.textContent = message;
		}
	});

	// Clear after a delay to allow subsequent announcements
	setTimeout(() => {
		if (liveRegion) {
			liveRegion.textContent = "";
		}
	}, 1000);
}
