import React, { useCallback, useEffect, useRef } from "react";
import { TIMEOUTS } from "@/config";
import { DocumentEditorActions, DocumentEditorForm } from "../../document/components";
import { useDocumentController } from "../../document/hooks/useDocumentController";
import { useHotkeys } from "../../hooks";
import { useEscapeHandler } from "../../hooks/useEscapeHandler";
import { findPane, usePaneLayout } from "../../pane";
import { useLatestRef } from "../../shared/hooks/useLatestRef";
import type { NavigationState, PageName } from "../../types";
import { Button, LoadingSpinner } from "../ui";
import { PaneHeader } from "./PaneHeader";

export interface PaneDocumentViewProps {
	paneId: string;
	documentPath: string;
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	suppressEscape?: boolean;
}

/**
 * Lightweight per-pane document rendering wrapper.
 * Uses useDocumentController internally but renders WITHOUT the Layout wrapper.
 * Each instance is independent with its own editor, auto-save, and scroll position.
 */
export const PaneDocumentView: React.FC<PaneDocumentViewProps> = React.memo(
	({ paneId, documentPath, onNavigate, suppressEscape }) => {
		const controller = useDocumentController({
			documentPath,
			onNavigate,
			paneId,
		});

		const { layout, updateScrollPosition, activePaneId } = usePaneLayout();
		const layoutRef = useLatestRef(layout);
		const suppressEscapeRef = useLatestRef(suppressEscape);

		useEscapeHandler({
			when: activePaneId === paneId,
			onEscape: (e) => {
				if (suppressEscapeRef.current) {
					e.preventDefault();
					return;
				}
				controller.escapeHandler(e);
				e.stopPropagation();
				e.stopImmediatePropagation();
			},
		});

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
				timeoutId = setTimeout(handleScroll, TIMEOUTS.scrollDebounceMs);
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
				<PaneHeader paneId={paneId} documentPath={documentPath} title={controller.documentTitle} />
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
						autoFocus={activePaneId === paneId}
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
