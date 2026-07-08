import { create } from "zustand";

/**
 * Tracks position within the app's navigation history so back/forward
 * affordances (HeaderBar buttons, Alt+←/→, mouse buttons 3/4) can reflect
 * whether there is anywhere to go. The actual history lives in the browser's
 * history stack (pushState/popstate, owned by useAppNavigation); this store only
 * mirrors the current index and the furthest-reached frontier.
 */
interface NavHistoryStore {
	/** Current position in the history stack (0 = initial entry). */
	index: number;
	/** Highest index reached; the forward frontier. */
	maxIndex: number;

	/** Record a genuine forward navigation (pushState). Returns the new index. */
	recordPush: () => number;
	/** Record a jump to an existing history entry (popstate). */
	recordPopTo: (index: number) => void;
	/**
	 * Seed the store from an existing history entry on mount (e.g. a page reload
	 * where the browser retained history.state.idx). The forward frontier can't be
	 * recovered after a reload, so maxIndex is pinned to the current index.
	 */
	hydrate: (index: number) => void;
}

export const useNavHistoryStore = create<NavHistoryStore>((set, get) => ({
	index: 0,
	maxIndex: 0,

	recordPush: () => {
		const nextIndex = get().index + 1;
		// A new navigation truncates any forward history.
		set({ index: nextIndex, maxIndex: nextIndex });
		return nextIndex;
	},

	recordPopTo: (index) => {
		set((state) => ({ index, maxIndex: Math.max(state.maxIndex, index) }));
	},

	hydrate: (index) => {
		set({ index, maxIndex: index });
	},
}));

/** Selector: whether there is a previous entry to go back to. */
export const selectCanGoBack = (s: NavHistoryStore): boolean => s.index > 0;
/** Selector: whether there is a forward entry to go to. */
export const selectCanGoForward = (s: NavHistoryStore): boolean => s.index < s.maxIndex;
