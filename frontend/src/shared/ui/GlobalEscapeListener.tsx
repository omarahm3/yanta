import { useEffect } from "react";
import { dispatchEscape } from "../stores/escapeRegistry.store";

/**
 * Global Escape key listener that dispatches to the LIFO escape registry.
 * Mount this once at the app root. It listens in capture phase so it runs
 * before other listeners, and stops propagation if a handler was called.
 */
export function GlobalEscapeListener() {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			const handled = dispatchEscape(e);
			if (handled) {
				e.preventDefault();
				e.stopPropagation();
			}
		};

		window.addEventListener("keydown", handleKeyDown, true);
		return () => window.removeEventListener("keydown", handleKeyDown, true);
	}, []);

	return null;
}
