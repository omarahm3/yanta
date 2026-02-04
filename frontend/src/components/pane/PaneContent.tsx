import type React from "react";
import { useCallback, useState } from "react";
import { usePaneLayout } from "../../hooks/usePaneLayout";
import { cn } from "../../lib/utils";
import { EmptyPane } from "./EmptyPane";
import { PaneDocumentView } from "./PaneDocumentView";
import { PaneHeader } from "./PaneHeader";

export interface PaneContentProps {
	paneId: string;
	documentPath: string | null;
}

/** Custom MIME types for drag & drop identification */
const MIME_DOCUMENT_PATH = "application/x-yanta-document-path";
const MIME_PANE_ID = "application/x-yanta-pane-id";

/**
 * Wrapper component that chooses between PaneDocumentView (when a document
 * is loaded) and EmptyPane (when no document is selected in the pane).
 *
 * Provides a pane-scoped navigation handler: document navigations open
 * in this specific pane, while non-document navigations are ignored
 * (handled at the App level).
 *
 * Also serves as the drop zone for drag-and-drop: accepts documents dragged
 * from the sidebar DocumentList and pane headers dragged from other panes.
 */
export const PaneContent: React.FC<PaneContentProps> = ({ paneId, documentPath }) => {
	const { openDocumentInPane, swapPaneDocuments, setActivePane } = usePaneLayout();
	const [isDragOver, setIsDragOver] = useState(false);

	// Pane-scoped navigation: intercept document navigation and open in this pane.
	// Non-document navigation (e.g., Escape → dashboard) is intentionally a no-op
	// in pane mode — panes don't navigate away from the document page.
	const handlePaneNavigate = useCallback(
		(page: string, state?: Record<string, string | number | boolean | undefined>) => {
			if (page === "document" && state?.documentPath) {
				openDocumentInPane(paneId, state.documentPath as string);
			}
		},
		[paneId, openDocumentInPane],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		const types = e.dataTransfer.types;
		if (types.includes(MIME_DOCUMENT_PATH) || types.includes(MIME_PANE_ID)) {
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			setIsDragOver(true);
		}
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		// Only reset when leaving the container entirely, not entering a child
		if (!e.currentTarget.contains(e.relatedTarget as Node)) {
			setIsDragOver(false);
		}
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);

			// Handle document dragged from sidebar DocumentList
			const droppedDocumentPath = e.dataTransfer.getData(MIME_DOCUMENT_PATH);
			if (droppedDocumentPath) {
				openDocumentInPane(paneId, droppedDocumentPath);
				setActivePane(paneId);
				return;
			}

			// Handle pane header dragged from another pane (swap documents)
			const sourcePaneId = e.dataTransfer.getData(MIME_PANE_ID);
			if (sourcePaneId && sourcePaneId !== paneId) {
				swapPaneDocuments(sourcePaneId, paneId);
				setActivePane(paneId);
			}
		},
		[paneId, openDocumentInPane, swapPaneDocuments, setActivePane],
	);

	if (documentPath) {
		return (
			<div
				className={cn(
					"flex flex-col h-full w-full transition-colors",
					isDragOver && "ring-2 ring-accent ring-inset",
				)}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				<PaneDocumentView
					paneId={paneId}
					documentPath={documentPath}
					onNavigate={handlePaneNavigate}
				/>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex flex-col h-full w-full transition-colors",
				isDragOver && "ring-2 ring-accent ring-inset",
			)}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<PaneHeader paneId={paneId} documentPath={null} />
			<EmptyPane isDragOver={isDragOver} />
		</div>
	);
};
