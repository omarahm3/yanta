import React, { useCallback, useEffect, useRef } from "react";
import { useHotkeys } from "../../hooks";
import { usePaneLayout } from "../../hooks/usePaneLayout";
import { useDocumentController } from "../../pages/document/useDocumentController";
import { findPane } from "../../utils/paneLayoutUtils";
import { DocumentEditorActions } from "../document/DocumentEditorActions";
import { DocumentEditorForm } from "../document/DocumentEditorForm";
import { Button, LoadingSpinner } from "../ui";
import { PaneHeader } from "./PaneHeader";

/** Debounce delay for scroll position tracking (ms) */
const SCROLL_DEBOUNCE_MS = 200;

export interface PaneDocumentViewProps {
	paneId: string;
	documentPath: string;
	onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
}

/**
 * Lightweight per-pane document rendering wrapper.
 * Uses useDocumentController internally but renders WITHOUT the Layout wrapper.
 * Each instance is independent with its own editor, auto-save, and scroll position.
 */
export const PaneDocumentView: React.FC<PaneDocumentViewProps> = React.memo(
	({ paneId, documentPath, onNavigate }) => {
		const controller = useDocumentController({
			documentPath,
			onNavigate,
			paneId,
		});

		const { layout, updateScrollPosition, activePaneId } = usePaneLayout();
		const layoutRef = useRef(layout);
		layoutRef.current = layout;
		const activePaneIdRef = useRef(activePaneId);
		activePaneIdRef.current = activePaneId;

		// Direct Escape: only active pane handles (blur on 1st, go to dashboard on 2nd).
		useEffect(() => {
			const onKeyDown = (e: KeyboardEvent) => {
				if (e.key !== "Escape") return;
				if (activePaneIdRef.current !== paneId) return;
				controller.escapeHandler(e);
				e.stopPropagation();
				e.stopImmediatePropagation();
			};
			window.addEventListener("keydown", onKeyDown, true);
			return () => window.removeEventListener("keydown", onKeyDown, true);
		}, [paneId, controller.escapeHandler]);

		const scrollContainerRef = useRef<HTMLDivElement>(null);
		const hasRestoredScrollRef = useRef(false);

		// Debounced scroll handler — updates pane scroll position in layout state
		const handleScroll = useCallback(() => {
			const container = scrollContainerRef.current;
			if (!container) return;
			updateScrollPosition(paneId, {
				top: container.scrollTop,
				left: container.scrollLeft,
			});
		}, [paneId, updateScrollPosition]);

		useEffect(() => {
			const container = scrollContainerRef.current;
			if (!container) return;

			let timeoutId: ReturnType<typeof setTimeout>;

			const onScroll = () => {
				clearTimeout(timeoutId);
				timeoutId = setTimeout(handleScroll, SCROLL_DEBOUNCE_MS);
			};

			container.addEventListener("scroll", onScroll, { passive: true });

			return () => {
				clearTimeout(timeoutId);
				container.removeEventListener("scroll", onScroll);
			};
		}, [handleScroll]);

		// Restore scroll position after content finishes loading
		useEffect(() => {
			if (controller.isLoading || hasRestoredScrollRef.current) return;

			const container = scrollContainerRef.current;
			if (!container) return;

			const pane = findPane(layoutRef.current.root, paneId);
			if (!pane || pane.type !== "leaf" || !pane.scrollPosition) return;

			const { top, left } = pane.scrollPosition;

			// Wait for content to render before restoring scroll
			const rafId = requestAnimationFrame(() => {
				container.scrollTop = top;
				container.scrollLeft = left;
				hasRestoredScrollRef.current = true;
			});

			return () => cancelAnimationFrame(rafId);
		}, [controller.isLoading, paneId]);

		// Reset scroll restoration flag when document changes
		useEffect(() => {
			hasRestoredScrollRef.current = false;
		}, [documentPath]);

		useHotkeys(controller.hotkeys);

		if (controller.isLoading) {
			return (
				<div className="flex flex-col h-full w-full">
					<PaneHeader paneId={paneId} documentPath={documentPath} />
					<div className="flex flex-1 items-center justify-center">
						<LoadingSpinner message="Loading document..." fullScreen={false} />
					</div>
				</div>
			);
		}

		if (controller.showError) {
			return (
				<div className="flex flex-col h-full w-full">
					<PaneHeader paneId={paneId} documentPath={documentPath} />
					<div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
						<div className="text-sm text-red font-medium">Document Not Found</div>
						<div className="text-text-dim text-xs text-center">
							Document could not be loaded. It may have been deleted.
						</div>
					</div>
				</div>
			);
		}

		const { contentProps } = controller;

		return (
			<div className="flex flex-col h-full w-full">
				<PaneHeader paneId={paneId} documentPath={documentPath} />
				{contentProps.isArchived && (
					<div className="flex flex-wrap items-center gap-3 border-b border-accent/30 bg-accent/10 px-4 py-2 text-xs uppercase tracking-widest text-accent">
						<span className="font-semibold">Archived</span>
						<span className="text-text-dim normal-case text-xs">Restore to resume editing.</span>
						{contentProps.onRestore && (
							<Button
								variant="primary"
								size="sm"
								onClick={contentProps.onRestore}
								disabled={contentProps.isRestoring}
								className="ml-auto text-xs font-semibold uppercase tracking-widest"
							>
								{contentProps.isRestoring ? "Restoring..." : "Restore"}
							</Button>
						)}
					</div>
				)}
				<div ref={scrollContainerRef} className="flex-1 overflow-auto min-h-0">
					<DocumentEditorForm
						blocks={contentProps.formData.blocks}
						tags={contentProps.formData.tags}
						isEditMode={contentProps.isEditMode}
						isLoading={contentProps.isLoading}
						isReadOnly={contentProps.isArchived}
						onTitleChange={contentProps.onTitleChange}
						onBlocksChange={contentProps.onBlocksChange}
						onTagRemove={contentProps.onTagRemove}
						onEditorReady={contentProps.onEditorReady}
					/>
				</div>
				<DocumentEditorActions
					saveState={contentProps.autoSave.saveState}
					lastSaved={contentProps.autoSave.lastSaved}
					hasUnsavedChanges={contentProps.autoSave.hasUnsavedChanges}
					saveError={contentProps.autoSave.saveError}
					isArchived={contentProps.isArchived}
				/>
			</div>
		);
	},
);

PaneDocumentView.displayName = "PaneDocumentView";
