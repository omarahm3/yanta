import { useEffect, useRef } from "react";
import { create } from "zustand";
import type { PersistStorage } from "zustand/middleware";
import { persist } from "zustand/middleware";
import type { PaneLayoutState } from "../../pane/types";
import { createDefaultPaneLayout } from "../../pane/types";
import { restoreLayout } from "../../pane/utils/paneLayoutUtils";
import { getMergedConfig } from "@/shared/stores/preferences.store";
import { BackendLogger } from "../utils/backendLogger";

const OLD_STORAGE_KEY = "yanta_pane_layout";
const STORAGE_KEY = "yanta_pane_layouts";
const PERSISTENCE_VERSION = 1;

interface PersistedLayoutEntry {
	root: PaneLayoutState["root"];
	activePaneId: string;
}

export interface PersistedLayoutMap {
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

function migrateFromOldKey(): void {
	try {
		const oldData = localStorage.getItem(OLD_STORAGE_KEY);
		if (oldData) {
			localStorage.removeItem(OLD_STORAGE_KEY);
		}
	} catch {
		// Ignore
	}
}

interface PaneLayoutStateStore {
	layoutMap: PersistedLayoutMap;
	saveLayoutForDocument: (docPath: string, state: PaneLayoutState) => void;
	clearLayoutForDocument: (docPath: string) => void;
	getLayoutForDocument: (docPath: string) => PaneLayoutState | null;
}

const paneLayoutStorage: PersistStorage<{ layoutMap: PersistedLayoutMap }> = {
	getItem: (name: string) => {
		try {
			migrateFromOldKey();
			const raw = localStorage.getItem(name);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as unknown;
			const layoutMap = validateLayoutMap(parsed);
			return layoutMap !== null ? { state: { layoutMap } } : null;
		} catch (err) {
			BackendLogger.error("[paneLayout.store] Failed to load:", err);
			return null;
		}
	},
	setItem: (name: string, value: { state: { layoutMap: PersistedLayoutMap } }) => {
		try {
			localStorage.setItem(name, JSON.stringify(value.state.layoutMap));
		} catch (err) {
			BackendLogger.error("[paneLayout.store] Failed to save:", err);
		}
	},
	removeItem: (name: string) => {
		try {
			localStorage.removeItem(name);
		} catch (err) {
			BackendLogger.error("[paneLayout.store] Failed to clear:", err);
		}
	},
};

export const usePaneLayoutStore = create<PaneLayoutStateStore>()(
	persist(
		(set, get) => ({
			layoutMap: getDefaultLayoutMap(),
			saveLayoutForDocument: (docPath, state) => {
				set((s) => ({
					layoutMap: {
						...s.layoutMap,
						layouts: {
							...s.layoutMap.layouts,
							[docPath]: {
								root: state.root,
								activePaneId: state.activePaneId,
							},
						},
					},
				}));
			},
			clearLayoutForDocument: (docPath) => {
				set((s) => {
					const { [docPath]: _, ...rest } = s.layoutMap.layouts;
					return {
						layoutMap: { ...s.layoutMap, layouts: rest },
					};
				});
			},
			getLayoutForDocument: (docPath) => {
				const { layoutMap } = get();
				const entry = layoutMap.layouts[docPath];
				if (!entry || !entry.root || typeof entry.activePaneId !== "string") {
					return null;
				}
				const restored = restoreLayout({
					root: entry.root,
					activePaneId: entry.activePaneId,
				});
				return { ...restored, primaryDocumentPath: docPath };
			},
		}),
		{
			name: STORAGE_KEY,
			storage: paneLayoutStorage,
			partialize: (s) => ({ layoutMap: s.layoutMap }),
		},
	),
);

export function loadPaneLayout(): PaneLayoutState {
	return createDefaultPaneLayout();
}

export function loadLayoutForDocument(docPath: string): PaneLayoutState | null {
	return usePaneLayoutStore.getState().getLayoutForDocument(docPath);
}

export function saveLayoutForDocument(docPath: string, state: PaneLayoutState): void {
	usePaneLayoutStore.getState().saveLayoutForDocument(docPath, state);
}

export function clearLayoutForDocument(docPath: string): void {
	usePaneLayoutStore.getState().clearLayoutForDocument(docPath);
}

function savePaneLayout(state: PaneLayoutState): void {
	if (!state.primaryDocumentPath) return;
	saveLayoutForDocument(state.primaryDocumentPath, state);
}

export function flushSaveLayout(state: PaneLayoutState): void {
	savePaneLayout(state);
}

export function usePanePersistence(state: PaneLayoutState): void {
	// Subscribe to store so it stays mounted and persists
	usePaneLayoutStore((s) => s.layoutMap);

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
		}, getMergedConfig().timeouts.savePersistenceDebounceMs);

		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [state]);
}

