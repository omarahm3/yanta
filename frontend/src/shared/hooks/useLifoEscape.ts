import { useEffect, useRef } from "react";
import { useDialog } from "../stores/dialog.store";
import { type EscapeHandler, useEscapeRegistryStore } from "../stores/escapeRegistry.store";
import { useLatestRef } from "./useLatestRef";

export interface UseLifoEscapeOptions {
	/** When false, the handler is not registered. */
	when: boolean;
	/** Called when Escape is pressed and this handler is topmost. */
	onEscape: EscapeHandler;
	/** If true (default), do not register when a dialog is open. */
	skipWhenDialogOpen?: boolean;
}

/**
 * Register an Escape handler in the LIFO escape registry. Only the topmost
 * (most recently registered) handler fires on Escape. The handler is
 * automatically unregistered when the component unmounts or `when` becomes
 * false.
 */
export function useLifoEscape({
	when,
	onEscape,
	skipWhenDialogOpen = true,
}: UseLifoEscapeOptions): void {
	const { isDialogOpen } = useDialog();
	const whenRef = useLatestRef(when);
	const onEscapeRef = useLatestRef(onEscape);
	const isDialogOpenRef = useLatestRef(isDialogOpen);
	const skipRef = useLatestRef(skipWhenDialogOpen);
	const registeredIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (!when) {
			if (registeredIdRef.current) {
				useEscapeRegistryStore.getState().remove(registeredIdRef.current);
				registeredIdRef.current = null;
			}
			return;
		}

		const handler: EscapeHandler = (e) => {
			if (!whenRef.current) return;
			if (skipRef.current && isDialogOpenRef.current) return;
			onEscapeRef.current(e);
		};

		if (!registeredIdRef.current) {
			registeredIdRef.current = useEscapeRegistryStore.getState().push(handler);
		}

		return () => {
			if (registeredIdRef.current) {
				useEscapeRegistryStore.getState().remove(registeredIdRef.current);
				registeredIdRef.current = null;
			}
		};
	}, [when, skipWhenDialogOpen]);
}
