import { useEffect, useRef } from "react";
import type { PaneLayoutState } from "../types/PaneLayout";
import { createDefaultPaneLayout } from "../types/PaneLayout";
import { restoreLayout } from "../utils/paneLayoutUtils";

const STORAGE_KEY = "yanta_pane_layout";
const SAVE_DEBOUNCE_MS = 500;
const PERSISTENCE_VERSION = 1;

interface PersistedPaneLayout {
	version: number;
	root: PaneLayoutState["root"];
	activePaneId: string;
}

/**
 * Load pane layout from localStorage, validating and falling back to default on failure.
 */
export function loadPaneLayout(): PaneLayoutState {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return createDefaultPaneLayout();
		}
		const parsed = JSON.parse(stored) as PersistedPaneLayout;
		if (parsed.version !== PERSISTENCE_VERSION) {
			return createDefaultPaneLayout();
		}
		return restoreLayout({
			root: parsed.root,
			activePaneId: parsed.activePaneId,
		});
	} catch {
		return createDefaultPaneLayout();
	}
}

/**
 * Save pane layout to localStorage.
 */
function savePaneLayout(state: PaneLayoutState): void {
	try {
		const data: PersistedPaneLayout = {
			version: PERSISTENCE_VERSION,
			root: state.root,
			activePaneId: state.activePaneId,
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {
		// Silently fail on localStorage errors (quota exceeded, etc.)
	}
}

/**
 * Hook that manages pane layout persistence to localStorage.
 * Debounces saves (500ms) and listens for cross-tab sync via StorageEvent.
 */
export function usePanePersistence(
	state: PaneLayoutState,
	onRestore: (state: PaneLayoutState) => void,
): void {
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isInitialMount = useRef(true);

	// Debounced save on state change
	useEffect(() => {
		// Skip the initial mount since state comes from localStorage
		if (isInitialMount.current) {
			isInitialMount.current = false;
			return;
		}

		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		debounceTimerRef.current = setTimeout(() => {
			savePaneLayout(state);
		}, SAVE_DEBOUNCE_MS);

		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [state]);

	// Cross-tab sync via StorageEvent
	useEffect(() => {
		const handleStorageChange = (event: StorageEvent) => {
			if (event.key === STORAGE_KEY) {
				onRestore(loadPaneLayout());
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => {
			window.removeEventListener("storage", handleStorageChange);
		};
	}, [onRestore]);
}
