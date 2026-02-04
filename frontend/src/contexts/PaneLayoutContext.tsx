import type React from "react";
import { createContext, useCallback, useMemo, useReducer } from "react";
import { clearPaneLayout, loadPaneLayout, usePanePersistence } from "../hooks/usePanePersistence";
import type { PaneLayoutState, ScrollPosition, SplitDirection } from "../types/PaneLayout";
import { createDefaultPaneLayout } from "../types/PaneLayout";
import {
	closePane as closePaneUtil,
	findPane,
	getLeaves,
	moveDocumentBetweenPanes as moveDocumentBetweenPanesUtil,
	openDocumentInPane as openDocumentInPaneUtil,
	resizePane as resizePaneUtil,
	splitPane as splitPaneUtil,
	swapPaneDocuments as swapPaneDocumentsUtil,
	updateScrollPosition as updateScrollPositionUtil,
} from "../utils/paneLayoutUtils";

// --- Action Types ---

type PaneLayoutAction =
	| { type: "SPLIT_PANE"; paneId: string; direction: SplitDirection }
	| { type: "CLOSE_PANE"; paneId: string }
	| { type: "RESIZE_PANE"; splitId: string; sizes: [number, number] }
	| { type: "OPEN_DOCUMENT"; paneId: string; documentPath: string | null }
	| { type: "SET_ACTIVE_PANE"; paneId: string }
	| { type: "MOVE_DOCUMENT"; sourcePaneId: string; targetPaneId: string }
	| { type: "SWAP_DOCUMENTS"; paneIdA: string; paneIdB: string }
	| { type: "UPDATE_SCROLL_POSITION"; paneId: string; scrollPosition: ScrollPosition }
	| { type: "RESTORE_LAYOUT"; state: PaneLayoutState }
	| { type: "RESET_LAYOUT" };

// --- Reducer ---

function paneLayoutReducer(state: PaneLayoutState, action: PaneLayoutAction): PaneLayoutState {
	switch (action.type) {
		case "SPLIT_PANE": {
			const newRoot = splitPaneUtil(state.root, action.paneId, action.direction);
			if (newRoot === state.root) return state;
			return { ...state, root: newRoot };
		}
		case "CLOSE_PANE": {
			const newRoot = closePaneUtil(state.root, action.paneId);
			if (newRoot === state.root) return state;
			const leaves = getLeaves(newRoot);
			const activeStillExists = leaves.some((leaf) => leaf.id === state.activePaneId);
			return {
				root: newRoot,
				activePaneId: activeStillExists ? state.activePaneId : leaves[0].id,
			};
		}
		case "RESIZE_PANE": {
			const newRoot = resizePaneUtil(state.root, action.splitId, action.sizes);
			if (newRoot === state.root) return state;
			return { ...state, root: newRoot };
		}
		case "OPEN_DOCUMENT": {
			const newRoot = openDocumentInPaneUtil(state.root, action.paneId, action.documentPath);
			if (newRoot === state.root) return state;
			return { ...state, root: newRoot };
		}
		case "SET_ACTIVE_PANE": {
			if (state.activePaneId === action.paneId) return state;
			const pane = findPane(state.root, action.paneId);
			if (!pane || pane.type !== "leaf") return state;
			return { ...state, activePaneId: action.paneId };
		}
		case "MOVE_DOCUMENT": {
			const newRoot = moveDocumentBetweenPanesUtil(
				state.root,
				action.sourcePaneId,
				action.targetPaneId,
			);
			if (newRoot === state.root) return state;
			return { ...state, root: newRoot };
		}
		case "SWAP_DOCUMENTS": {
			const newRoot = swapPaneDocumentsUtil(state.root, action.paneIdA, action.paneIdB);
			if (newRoot === state.root) return state;
			return { ...state, root: newRoot };
		}
		case "UPDATE_SCROLL_POSITION": {
			const newRoot = updateScrollPositionUtil(
				state.root,
				action.paneId,
				action.scrollPosition,
			);
			if (newRoot === state.root) return state;
			return { ...state, root: newRoot };
		}
		case "RESTORE_LAYOUT": {
			return action.state;
		}
		case "RESET_LAYOUT": {
			return createDefaultPaneLayout();
		}
		default:
			return state;
	}
}

// --- Context ---

export interface PaneLayoutContextValue {
	layout: PaneLayoutState;
	activePaneId: string;
	splitPane: (paneId: string, direction: SplitDirection) => void;
	closePane: (paneId: string) => void;
	resizePane: (splitId: string, sizes: [number, number]) => void;
	openDocumentInPane: (paneId: string, documentPath: string | null) => void;
	setActivePane: (paneId: string) => void;
	moveDocumentBetweenPanes: (sourcePaneId: string, targetPaneId: string) => void;
	swapPaneDocuments: (paneIdA: string, paneIdB: string) => void;
	updateScrollPosition: (paneId: string, scrollPosition: ScrollPosition) => void;
	resetLayout: () => void;
}

export const PaneLayoutContext = createContext<PaneLayoutContextValue | undefined>(undefined);

// --- Provider ---

export const PaneLayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [state, dispatch] = useReducer(paneLayoutReducer, undefined, loadPaneLayout);

	const handleRestore = useCallback((restoredState: PaneLayoutState) => {
		dispatch({ type: "RESTORE_LAYOUT", state: restoredState });
	}, []);

	usePanePersistence(state, handleRestore);

	const splitPane = useCallback((paneId: string, direction: SplitDirection) => {
		dispatch({ type: "SPLIT_PANE", paneId, direction });
	}, []);

	const closePane = useCallback((paneId: string) => {
		dispatch({ type: "CLOSE_PANE", paneId });
	}, []);

	const resizePane = useCallback((splitId: string, sizes: [number, number]) => {
		dispatch({ type: "RESIZE_PANE", splitId, sizes });
	}, []);

	const openDocumentInPane = useCallback((paneId: string, documentPath: string | null) => {
		dispatch({ type: "OPEN_DOCUMENT", paneId, documentPath });
	}, []);

	const setActivePane = useCallback((paneId: string) => {
		dispatch({ type: "SET_ACTIVE_PANE", paneId });
	}, []);

	const moveDocumentBetweenPanes = useCallback((sourcePaneId: string, targetPaneId: string) => {
		dispatch({ type: "MOVE_DOCUMENT", sourcePaneId, targetPaneId });
	}, []);

	const swapPaneDocuments = useCallback((paneIdA: string, paneIdB: string) => {
		dispatch({ type: "SWAP_DOCUMENTS", paneIdA, paneIdB });
	}, []);

	const updateScrollPosition = useCallback(
		(paneId: string, scrollPosition: ScrollPosition) => {
			dispatch({ type: "UPDATE_SCROLL_POSITION", paneId, scrollPosition });
		},
		[],
	);

	const resetLayout = useCallback(() => {
		clearPaneLayout();
		dispatch({ type: "RESET_LAYOUT" });
	}, []);

	const value = useMemo<PaneLayoutContextValue>(
		() => ({
			layout: state,
			activePaneId: state.activePaneId,
			splitPane,
			closePane,
			resizePane,
			openDocumentInPane,
			setActivePane,
			moveDocumentBetweenPanes,
			swapPaneDocuments,
			updateScrollPosition,
			resetLayout,
		}),
		[
			state,
			splitPane,
			closePane,
			resizePane,
			openDocumentInPane,
			setActivePane,
			moveDocumentBetweenPanes,
			swapPaneDocuments,
			updateScrollPosition,
			resetLayout,
		],
	);

	return <PaneLayoutContext.Provider value={value}>{children}</PaneLayoutContext.Provider>;
};
