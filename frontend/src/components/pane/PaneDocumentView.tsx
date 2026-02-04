import React from "react";
import { useHotkeys } from "../../hooks";
import { useDocumentController } from "../../pages/document/useDocumentController";
import { DocumentEditorActions } from "../document/DocumentEditorActions";
import { DocumentEditorForm } from "../document/DocumentEditorForm";
import { Button, LoadingSpinner } from "../ui";
import { PaneHeader } from "./PaneHeader";

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
		});

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
