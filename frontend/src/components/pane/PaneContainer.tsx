import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Group, type Layout, Panel, Separator } from "react-resizable-panels";
import { cn } from "../../lib/utils";
import type { PaneLeaf, PaneNode, PaneSplit, SplitDirection } from "../../pane";
import { usePaneLayout } from "../../pane";
import { PaneContent } from "./PaneContent";

// --- Resize Handle ---

interface PaneResizeHandleProps {
	direction: SplitDirection;
}

const PaneResizeHandle: React.FC<PaneResizeHandleProps> = React.memo(({ direction }) => (
	<Separator
		className={cn(
			"relative flex items-center justify-center transition-colors",
			"bg-border hover:bg-accent/50 active:bg-accent",
			direction === "horizontal" ? "w-1" : "h-1",
		)}
	/>
));

PaneResizeHandle.displayName = "PaneResizeHandle";

// --- Leaf View ---

interface PaneLeafViewProps {
	node: PaneLeaf;
}

/**
 * Renders a leaf pane with active pane tracking.
 * Clicking or focusing within a pane sets it as the active pane.
 * When this pane becomes active (e.g. via Ctrl+H/J/K/L), focus is moved here
 * so the cursor and keyboard input follow.
 */
const PaneLeafView: React.FC<PaneLeafViewProps> = React.memo(({ node }) => {
	const { activePaneId, setActivePane } = usePaneLayout();
	const isActive = activePaneId === node.id;
	const containerRef = useRef<HTMLDivElement>(null);

	const handleFocus = useCallback(() => {
		setActivePane(node.id);
	}, [node.id, setActivePane]);

	// When this pane becomes the active pane (e.g. via keyboard navigation),
	// move DOM focus here so the user can type in this pane immediately.
	// Skip for empty panes — EmptyPaneDocumentPicker manages its own focus.
	useEffect(() => {
		if (!isActive || !containerRef.current || !node.documentPath) return;
		containerRef.current.focus();
		// Focus the editor's contenteditable if present so typing works without an extra click
		let rafId: number;
		rafId = requestAnimationFrame(() => {
			const editable = containerRef.current?.querySelector(
				'[contenteditable="true"]',
			) as HTMLElement | null;
			if (editable) {
				editable.focus();
			}
		});
		return () => cancelAnimationFrame(rafId);
	}, [isActive, node.documentPath]);

	return (
		<div
			ref={containerRef}
			tabIndex={-1}
			className={cn(
				"flex flex-col h-full w-full overflow-hidden outline-none",
				isActive && "ring-1 ring-accent/30",
			)}
			onMouseDown={handleFocus}
			onFocusCapture={handleFocus}
		>
			<PaneContent paneId={node.id} documentPath={node.documentPath} />
		</div>
	);
});

PaneLeafView.displayName = "PaneLeafView";

// --- Split View ---

interface PaneSplitViewProps {
	node: PaneSplit;
}

const PaneSplitView: React.FC<PaneSplitViewProps> = React.memo(({ node }) => {
	const { resizePane } = usePaneLayout();

	const firstPanelId = `${node.id}-0`;
	const secondPanelId = `${node.id}-1`;

	const defaultLayout = useMemo<Layout>(
		() => ({
			[firstPanelId]: node.sizes[0],
			[secondPanelId]: node.sizes[1],
		}),
		[firstPanelId, secondPanelId, node.sizes],
	);

	const handleLayoutChanged = useCallback(
		(layout: Layout) => {
			const firstSize = layout[firstPanelId];
			const secondSize = layout[secondPanelId];
			if (firstSize !== undefined && secondSize !== undefined) {
				resizePane(node.id, [firstSize, secondSize]);
			}
		},
		[node.id, firstPanelId, secondPanelId, resizePane],
	);

	return (
		<Group
			id={node.id}
			orientation={node.direction}
			defaultLayout={defaultLayout}
			onLayoutChanged={handleLayoutChanged}
		>
			<Panel id={firstPanelId} minSize="15%">
				<PaneContainer node={node.children[0]} />
			</Panel>
			<PaneResizeHandle direction={node.direction} />
			<Panel id={secondPanelId} minSize="15%">
				<PaneContainer node={node.children[1]} />
			</Panel>
		</Group>
	);
});

PaneSplitView.displayName = "PaneSplitView";

// --- Container ---

export interface PaneContainerProps {
	node: PaneNode;
}

/**
 * Recursively renders the pane layout tree.
 * For PaneSplit nodes, renders a Group with orientation and two children
 * separated by a Separator resize handle.
 * For PaneLeaf nodes, renders PaneContent (document editor or empty pane).
 */
export const PaneContainer: React.FC<PaneContainerProps> = React.memo(({ node }) => {
	if (node.type === "split") {
		return <PaneSplitView node={node} />;
	}
	return <PaneLeafView node={node} />;
});

PaneContainer.displayName = "PaneContainer";
