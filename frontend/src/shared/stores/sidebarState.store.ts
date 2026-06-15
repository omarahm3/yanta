import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BackendLogger } from "../utils/backendLogger";

export interface PinnedDocument {
	path: string;
	title: string;
	projectAlias: string;
}

interface SidebarStateStore {
	collapsedSections: string[];
	sidebarWidth: number;
	pinnedDocuments: PinnedDocument[];

	toggleSection: (sectionId: string) => void;
	isSectionCollapsed: (sectionId: string) => boolean;
	setSidebarWidth: (width: number) => void;
	pinDocument: (doc: PinnedDocument) => void;
	unpinDocument: (path: string) => void;
	isPinned: (path: string) => boolean;
}

const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_WIDTH = 360;
const DEFAULT_SIDEBAR_WIDTH = 192;

export const useSidebarStateStore = create<SidebarStateStore>()(
	persist(
		(set, get) => ({
			collapsedSections: [],
			sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
			pinnedDocuments: [],

			toggleSection: (sectionId) => {
				set((state) => {
					const isCollapsed = state.collapsedSections.includes(sectionId);
					return {
						collapsedSections: isCollapsed
							? state.collapsedSections.filter((id) => id !== sectionId)
							: [...state.collapsedSections, sectionId],
					};
				});
			},

			isSectionCollapsed: (sectionId) => {
				return get().collapsedSections.includes(sectionId);
			},

			setSidebarWidth: (width) => {
				const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
				set({ sidebarWidth: clamped });
			},

			pinDocument: (doc) => {
				set((state) => {
					if (state.pinnedDocuments.some((d) => d.path === doc.path)) return state;
					return { pinnedDocuments: [...state.pinnedDocuments, doc] };
				});
			},

			unpinDocument: (path) => {
				set((state) => ({
					pinnedDocuments: state.pinnedDocuments.filter((d) => d.path !== path),
				}));
			},

			isPinned: (path) => {
				return get().pinnedDocuments.some((d) => d.path === path);
			},
		}),
		{
			name: "yanta_sidebar_state",
			onRehydrateStorage: () => (_state, error) => {
				if (error) {
					BackendLogger.error("[sidebarState.store] Failed to rehydrate:", error);
				}
			},
		},
	),
);
