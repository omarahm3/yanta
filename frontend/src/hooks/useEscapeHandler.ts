import { useEffect } from "react";
import { useDialog } from "../contexts/DialogContext";
import { useLatestRef } from "../shared/hooks/useLatestRef";

export interface UseEscapeHandlerOptions {
	/** When false, the handler is not registered. When true, Escape will trigger onEscape (unless dialog blocks it). */
	when: boolean;
	/** Called when Escape is pressed, when() is true, and no dialog is open (unless skipWhenDialogOpen is false). */
	onEscape: (e: KeyboardEvent) => void;
	/** If true (default), do not run onEscape when a dialog is open. Set false for overlay-style UI that is itself dialog-like (e.g. welcome overlay). */
	skipWhenDialogOpen?: boolean;
	/** Use capture phase. Default true so pane handlers run before other listeners. */
	capture?: boolean;
}

/**
 * Subscribes to window keydown and invokes onEscape when Escape is pressed,
 * when() is true, and (optionally) no dialog is open.
 * Stores handler and conditions in refs so the effect does not re-subscribe when
 * they change (advanced-event-handler-refs). For many panes, a future optimization
 * could deduplicate to one global Escape listener with a registry (client-event-listeners).
 */
export function useEscapeHandler({
	when,
	onEscape,
	skipWhenDialogOpen = true,
	capture = true,
}: UseEscapeHandlerOptions): void {
	const { isDialogOpen } = useDialog();
	const whenRef = useLatestRef(when);
	const onEscapeRef = useLatestRef(onEscape);
	const isDialogOpenRef = useLatestRef(isDialogOpen);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			if (!whenRef.current) return;
			if (skipWhenDialogOpen && isDialogOpenRef.current) return;

			onEscapeRef.current(e);
			// Callback may call preventDefault/stopPropagation (e.g. PaneDocumentView only stops when not suppressEscape)
		};

		window.addEventListener("keydown", handleKeyDown, capture);
		return () => window.removeEventListener("keydown", handleKeyDown, capture);
	}, [skipWhenDialogOpen, capture]);
}
