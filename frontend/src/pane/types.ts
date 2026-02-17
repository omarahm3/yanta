import { LAYOUT } from "@/config/public";

export type SplitDirection = "horizontal" | "vertical";

export interface ScrollPosition {
	top: number;
	left: number;
}

export interface PaneLeaf {
	type: "leaf";
	id: string;
	documentPath: string | null;
	scrollPosition?: ScrollPosition;
}

export interface PaneSplit {
	type: "split";
	id: string;
	direction: SplitDirection;
	children: [PaneNode, PaneNode];
	sizes: [number, number];
}

export type PaneNode = PaneLeaf | PaneSplit;

export interface PaneLayoutState {
	root: PaneNode;
	activePaneId: string;
	primaryDocumentPath: string | null;
}

export const MAX_PANES = LAYOUT.maxPanes;

export function createDefaultPaneLayout(): PaneLayoutState {
	return {
		root: {
			type: "leaf",
			id: "pane-1",
			documentPath: null,
		},
		activePaneId: "pane-1",
		primaryDocumentPath: null,
	};
}
