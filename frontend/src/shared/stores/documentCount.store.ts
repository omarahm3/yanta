import { create } from "zustand";
import { GetAllDocumentCounts } from "../../../bindings/yanta/internal/project/service";
import { BackendLogger } from "../../utils/backendLogger";

interface DocumentCountState {
	counts: Map<string, number>;
	isLoading: boolean;
	getCount: (projectId: string) => number;
	setCounts: (counts: Map<string, number>) => void;
	setLoading: (loading: boolean) => void;
	refreshCount: (projectId: string, count: number) => void;
	refreshCounts: () => Promise<void>;
}

export const useDocumentCountStore = create<DocumentCountState>((set, get) => ({
	counts: new Map(),
	isLoading: false,
	getCount: (projectId) => get().counts.get(projectId) ?? 0,
	setCounts: (counts) => set({ counts }),
	setLoading: (isLoading) => set({ isLoading }),
	refreshCount: (projectId, count) =>
		set((s) => {
			const next = new Map(s.counts);
			next.set(projectId, count);
			return { counts: next };
		}),
	refreshCounts: async () => {
		set({ isLoading: true });
		try {
			const countsObj = await GetAllDocumentCounts();
			const countsMap = new Map<string, number>();
			Object.entries(countsObj).forEach(([projectId, count]) => {
				countsMap.set(projectId, count as number);
			});
			set({ counts: countsMap });
		} catch (err) {
			BackendLogger.error("Failed to load document counts:", err);
		} finally {
			set({ isLoading: false });
		}
	},
}));

export interface DocumentCountContextValue {
	counts: Map<string, number>;
	getCount: (projectId: string) => number;
	refreshCounts: () => Promise<void>;
	refreshCount: (projectId: string, count: number) => void;
	isLoading: boolean;
}

/** Same API as legacy useDocumentCount — use in components. */
export function useDocumentCount(): DocumentCountContextValue {
	const counts = useDocumentCountStore((s) => s.counts);
	const isLoading = useDocumentCountStore((s) => s.isLoading);
	const getCount = useDocumentCountStore((s) => s.getCount);
	const refreshCounts = useDocumentCountStore((s) => s.refreshCounts);
	const refreshCount = useDocumentCountStore((s) => s.refreshCount);
	return { counts, getCount, refreshCounts, refreshCount, isLoading };
}
