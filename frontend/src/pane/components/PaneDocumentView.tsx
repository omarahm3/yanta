import React, { useCallback, useEffect, useRef } from "react";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import {
	ConflictBanner,
	DocumentEditorActions,
	DocumentEditorForm,
} from "../../document/components";
import { useDocumentController } from "../../document/hooks/useDocumentController";
import { useHotkeys } from "../../hotkeys";
import { useEscapeHandler } from "../../shared/hooks";
import { useLatestRef } from "../../shared/hooks/useLatestRef";
import type { NavigationState, PageName } from "../../shared/types";
import { Button, LoadingSpinner } from "../../shared/ui";
import { findPane, usePaneLayout } from "..";
import { PaneHeader } from "./PaneHeader";

export interface PaneDocumentViewProps {
	paneId: string;
	documentPath: string;
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	onOpenPicker?: () => void;
	suppressEscape?: boolean;
}

/**
 * Lightweight per-pane document rendering wrapper.
 * Uses useDocumentController internally but renders WITHOUT the Layout wrapper.
 * Each instance is independent with its own editor, auto-save, and scroll position.
 */
export const PaneDocumentView: React.FC<PaneDocumentViewProps> = React.memo(
	({ paneId, documentPath, onNavigate, onOpenPicker, suppressEscape }) => {
		const controller = useDocumentController({
			documentPath,
			onNavigate,
			paneId,
		});

		const { timeouts } = useMergedConfig();
		const { layout, updateScrollPosition, activePaneId } = usePaneLayout();
		const layoutRef = useLatestRef(layout);
		const suppressEscapeRef = useLatestRef(suppressEscape);

		// On a canvas pane, Escape is layered (see useCanvasEscapeSequence): the 1st
		// tap is yielded to Excalidraw, the 2nd unfocuses the canvas, the 3rd navigates
		// back. controller.escapeHandler owns that decision AND the propagation control
		// — it stops propagation only for the 2nd/3rd taps — so we must NOT stop it here
		// or the 1st tap would never reach Excalidraw. The document hotkeys are also
		// reduced to Save-only for canvases (useDocumentHotkeysConfig).
		const isCanvas = controller.contentProps.formData.kind === "canvas";

		useEscapeHandler({
			when: activePaneId === paneId,
			onEscape: (e) => {
				// A picker overlay is open on top of this pane — let ITS Escape
				// handler run. Handling Escape here would close the underlying
				// document, and stopImmediatePropagation would block the picker's own
				// capture-phase close.
				if (suppressEscapeRef.current) return;
				if (isCanvas) {
					// Layered canvas Escape: escapeHandler owns propagation control (it
					// yields the 1st tap to Excalidraw, stops the 2nd/3rd), so we must
					// not stop propagation here.
					controller.escapeHandler(e);
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
				timeoutId = setTimeout(handleScroll, timeouts.scrollDebounceMs);
			};

			container.addEventListener("scroll", onScroll, { passive: true });

			return () => {
				clearTimeout(timeoutId);
				container.removeEventListener("scroll", onScroll);
			};
		}, [handleScroll, timeouts.scrollDebounceMs]);

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
						<div className="flex gap-2">
							{onOpenPicker && (
								<Button variant="primary" size="sm" onClick={onOpenPicker}>
									Open a document
								</Button>
							)}
							{onNavigate && (
								<Button variant="ghost" size="sm" onClick={() => onNavigate("dashboard")}>
									Go to dashboard
								</Button>
							)}
						</div>
					</div>
				</div>
			);
		}

		const { contentProps } = controller;

		return (
			<div className="flex flex-col h-full w-full">
				<PaneHeader
					paneId={paneId}
					documentPath={documentPath}
					title={controller.documentTitle}
					kind={contentProps.formData.kind}
				/>
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
				{controller.hasConflict && (
					<ConflictBanner
						onKeepMine={controller.onKeepMine}
						onReloadFromDisk={controller.onReloadFromDisk}
						compact
					/>
				)}
				<div ref={scrollContainerRef} className="flex flex-col flex-1 min-h-0 overflow-auto">
					<DocumentEditorForm
						blocks={contentProps.formData.blocks}
						tags={contentProps.formData.tags}
						kind={contentProps.formData.kind}
						scene={contentProps.formData.scene}
						projectAlias={contentProps.currentProject?.alias ?? ""}
						isEditMode={contentProps.isEditMode}
						isLoading={contentProps.isLoading}
						isReadOnly={contentProps.isArchived}
						autoFocus={activePaneId === paneId}
						onTitleChange={contentProps.onTitleChange}
						onBlocksChange={contentProps.onBlocksChange}
						onSceneChange={contentProps.onSceneChange}
						onTagRemove={contentProps.onTagRemove}
						onEditorReady={contentProps.onEditorReady}
						onCanvasReady={contentProps.onCanvasReady}
						find={contentProps.find}
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
