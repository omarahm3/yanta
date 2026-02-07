import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { PANE_SHORTCUTS } from "../../config";
import { useHotkey } from "../../hooks/useHotkey";
import { useEscapeHandler } from "../../hooks/useEscapeHandler";
import { useLatestRef } from "../../shared/hooks/useLatestRef";
import { cn } from "../../lib/utils";
import { countLeaves, usePaneLayout } from "../../pane";
import { EmptyPaneDocumentPicker } from "./EmptyPaneDocumentPicker";
import { PaneDocumentView } from "./PaneDocumentView";
import { PaneHeader } from "./PaneHeader";
import { usePaneNavigateContext } from "./PaneNavigateContext";

export interface PaneContentProps {
	paneId: string;
	documentPath: string | null;
}

const MIME_DOCUMENT_PATH = "application/x-yanta-document-path";
const MIME_PANE_ID = "application/x-yanta-pane-id";

export const PaneContent: React.FC<PaneContentProps> = ({ paneId, documentPath }) => {
	const { layout, openDocumentInPane, swapPaneDocuments, setActivePane, closePane, activePaneId } =
		usePaneLayout();
	const appOnNavigate = usePaneNavigateContext();
	const [isDragOver, setIsDragOver] = useState(false);
	const [showPicker, setShowPicker] = useState(false);

	const layoutRef = useLatestRef(layout);
	const activePaneIdRef = useLatestRef(activePaneId);

	useEscapeHandler({
		when: !documentPath && activePaneId === paneId,
		onEscape: (e) => {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			if (countLeaves(layoutRef.current.root) > 1) {
				closePane(paneId);
			}
		},
	});

	useEffect(() => {
		setShowPicker(false);
	}, [documentPath]);

	useHotkey({
		...PANE_SHORTCUTS.documentPicker,
		allowInInput: true,
		capture: true,
		handler: (e: KeyboardEvent) => {
			if (activePaneIdRef.current !== paneId) return false;
			e.preventDefault();
			setShowPicker((prev) => !prev);
		},
	});

	const handlePaneNavigate = useCallback(
		(page: string, state?: Record<string, string | number | boolean | undefined>) => {
			if (page === "document" && state?.documentPath) {
				openDocumentInPane(paneId, state.documentPath as string);
			}
			appOnNavigate?.(page, state);
		},
		[paneId, openDocumentInPane, appOnNavigate],
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

	return (
		<div
			className={cn(
				"relative flex flex-col h-full w-full transition-colors",
				isDragOver && "ring-2 ring-accent ring-inset",
			)}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{documentPath ? (
				<>
					<PaneDocumentView
						key={documentPath}
						paneId={paneId}
						documentPath={documentPath}
						onNavigate={handlePaneNavigate}
						suppressEscape={showPicker}
					/>
					{showPicker && (
						<div className="absolute inset-0 z-10 bg-glass-bg/90 backdrop-blur-xl flex flex-col">
							<PaneHeader paneId={paneId} documentPath={documentPath} />
							<EmptyPaneDocumentPicker paneId={paneId} onClose={() => setShowPicker(false)} />
						</div>
					)}
				</>
			) : (
				<>
					<PaneHeader paneId={paneId} documentPath={null} />
					<EmptyPaneDocumentPicker paneId={paneId} isDragOver={isDragOver} />
				</>
			)}
		</div>
	);
};
