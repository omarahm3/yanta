import { create } from "zustand";
import type { SidebarSection } from "../../shared/ui";

const SOURCE_ORDER = ["core", "additional"] as const;

interface SidebarRegistryState {
	sources: Record<string, SidebarSection[]>;
	setSections: (source: string, sections: SidebarSection[]) => void;
	removeSource: (source: string) => void;
	getAllSections: () => SidebarSection[];
}

export const useSidebarRegistryStore = create<SidebarRegistryState>((set, get) => ({
	sources: {},

	setSections: (source, sections) => {
		set((state) => ({
			sources: { ...state.sources, [source]: sections },
		}));
	},

	removeSource: (source) => {
		set((state) => {
			const next = { ...state.sources };
			delete next[source];
			return { sources: next };
		});
	},

	getAllSections: () => {
		const { sources } = get();
		const result: SidebarSection[] = [];
		for (const key of SOURCE_ORDER) {
			const list = sources[key];
			if (list?.length) result.push(...list);
		}
		for (const key of Object.keys(sources)) {
			if (SOURCE_ORDER.includes(key as (typeof SOURCE_ORDER)[number])) continue;
			result.push(...(sources[key] ?? []));
		}
		return result;
	},
}));
