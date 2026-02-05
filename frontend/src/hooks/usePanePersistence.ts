import { useEffect, useRef } from "react";
import type { PaneLayoutState } from "../types/PaneLayout";
import { createDefaultPaneLayout } from "../types/PaneLayout";
import { restoreLayout } from "../utils/paneLayoutUtils";

const OLD_STORAGE_KEY = "yanta_pane_layout";
const STORAGE_KEY = "yanta_pane_layouts";
const SAVE_DEBOUNCE_MS = 500;
const PERSISTENCE_VERSION = 1;

interface PersistedLayoutEntry {
	root: PaneLayoutState["root"];
	activePaneId: string;
}

interface PersistedLayoutMap {
	version: number;
	layouts: Record<string, PersistedLayoutEntry>;
}

function loadLayoutMap(): PersistedLayoutMap {
	try {
		const oldData = localStorage.getItem(OLD_STORAGE_KEY);
		if (oldData) {
			localStorage.removeItem(OLD_STORAGE_KEY);
		}

		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return { version: PERSISTENCE_VERSION, layouts: {} };
		}
		const parsed = JSON.parse(stored);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			Array.isArray(parsed) ||
			parsed.version !== PERSISTENCE_VERSION ||
			typeof parsed.layouts !== "object"
		) {
			return { version: PERSISTENCE_VERSION, layouts: {} };
		}
		return parsed as PersistedLayoutMap;
	} catch {
		return { version: PERSISTENCE_VERSION, layouts: {} };
	}
}

function saveLayoutMap(map: PersistedLayoutMap): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
	} catch (err) {
		console.error("[usePanePersistence] Failed to save to localStorage:", err);
	}
}

export function loadPaneLayout(): PaneLayoutState {
	return createDefaultPaneLayout();
}

export function loadLayoutForDocument(docPath: string): PaneLayoutState | null {
	const map = loadLayoutMap();
	const entry = map.layouts[docPath];
	if (!entry || !entry.root || typeof entry.activePaneId !== "string") {
		return null;
	}
	const restored = restoreLayout({
		root: entry.root,
		activePaneId: entry.activePaneId,
	});
	return { ...restored, primaryDocumentPath: docPath };
}

export function saveLayoutForDocument(docPath: string, state: PaneLayoutState): void {
	const map = loadLayoutMap();
	map.layouts[docPath] = {
		root: state.root,
		activePaneId: state.activePaneId,
	};
	saveLayoutMap(map);
}

export function clearLayoutForDocument(docPath: string): void {
	const map = loadLayoutMap();
	delete map.layouts[docPath];
	saveLayoutMap(map);
}

function savePaneLayout(state: PaneLayoutState): void {
	if (!state.primaryDocumentPath) return;
	saveLayoutForDocument(state.primaryDocumentPath, state);
}

export function flushSaveLayout(state: PaneLayoutState): void {
	savePaneLayout(state);
}

export function usePanePersistence(state: PaneLayoutState): void {
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isInitialMount = useRef(true);

	useEffect(() => {
		if (isInitialMount.current) {
			isInitialMount.current = false;
			return;
		}

		if (!state.primaryDocumentPath) return;

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
}
