import { useEffect, useRef } from "react";
import { TIMEOUTS } from "@/config";
import { useLocalStorage } from "../../shared/hooks/useLocalStorage";
import { BackendLogger } from "../../utils/backendLogger";
import type { PaneLayoutState } from "../types";
import { createDefaultPaneLayout } from "../types";
import { restoreLayout } from "../utils/paneLayoutUtils";

const OLD_STORAGE_KEY = "yanta_pane_layout";
const STORAGE_KEY = "yanta_pane_layouts";
const PERSISTENCE_VERSION = 1;

interface PersistedLayoutEntry {
	root: PaneLayoutState["root"];
	activePaneId: string;
}

interface PersistedLayoutMap {
	version: number;
	layouts: Record<string, PersistedLayoutEntry>;
}

function getDefaultLayoutMap(): PersistedLayoutMap {
	return { version: PERSISTENCE_VERSION, layouts: {} };
}

function validateLayoutMap(data: unknown): PersistedLayoutMap | null {
	if (
		typeof data !== "object" ||
		data === null ||
		Array.isArray(data) ||
		(data as PersistedLayoutMap).version !== PERSISTENCE_VERSION ||
		typeof (data as PersistedLayoutMap).layouts !== "object"
	) {
		return null;
	}
	return data as PersistedLayoutMap;
}

function deserializeLayoutMap(raw: string): unknown {
	try {
		const oldData = localStorage.getItem(OLD_STORAGE_KEY);
		if (oldData) {
			localStorage.removeItem(OLD_STORAGE_KEY);
		}
	} catch {
		// Ignore cleanup errors
	}
	return JSON.parse(raw);
}

let globalLayoutMapSetter:
	| ((value: PersistedLayoutMap | ((prev: PersistedLayoutMap) => PersistedLayoutMap)) => void)
	| null = null;

function loadLayoutMap(): PersistedLayoutMap {
	try {
		const oldData = localStorage.getItem(OLD_STORAGE_KEY);
		if (oldData) {
			localStorage.removeItem(OLD_STORAGE_KEY);
		}

		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return getDefaultLayoutMap();
		}
		const parsed = JSON.parse(stored);
		const validated = validateLayoutMap(parsed);
		return validated ?? getDefaultLayoutMap();
	} catch {
		return getDefaultLayoutMap();
	}
}

function saveLayoutMap(map: PersistedLayoutMap): void {
	if (globalLayoutMapSetter) {
		globalLayoutMapSetter(map);
	} else {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
		} catch (err) {
			BackendLogger.error("[usePanePersistence] Failed to save to localStorage:", err);
		}
	}
}

function useLayoutMapStorage(): void {
	const [, setLayoutMap] = useLocalStorage<PersistedLayoutMap>(STORAGE_KEY, getDefaultLayoutMap(), {
		validate: validateLayoutMap,
		deserialize: deserializeLayoutMap,
		onError: (operation, err) => {
			BackendLogger.error(`[usePanePersistence] Failed to ${operation}:`, err);
		},
	});

	useEffect(() => {
		globalLayoutMapSetter = setLayoutMap;
		return () => {
			globalLayoutMapSetter = null;
		};
	}, [setLayoutMap]);
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
	useLayoutMapStorage();

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
		}, TIMEOUTS.savePersistenceDebounceMs);

		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [state]);
}
