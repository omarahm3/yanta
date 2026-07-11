import { FileText, Pin, PinOff } from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import { Layout } from "@/app";
import type { DocumentFindControls } from "../../editor/find";
import type { EditorHandle } from "../../editor/types";
import type { SaveState } from "../../shared/hooks";
import { useSidebarStateStore } from "../../shared/stores/sidebarState.store";
import type { NavigationState, PageName } from "../../shared/types";
import type { BlockNoteBlock } from "../../shared/types/Document";
import type { Project } from "../../shared/types/Project";
import { Button, type SidebarSection } from "../../shared/ui";
import { ConflictBanner } from "./ConflictBanner";
import { DocumentEditorActions } from "./DocumentEditorActions";
import { DocumentEditorForm } from "./DocumentEditorForm";
import { DocumentOutline } from "./DocumentOutline";

export interface DocumentContentProps {
	sidebarSections: SidebarSection[];
	currentProject: Project | undefined;
	/** Path of the current document — used for pinning and breadcrumbs */
	documentPath?: string;
	/** Title of the current document — used for breadcrumbs and pin label */
	documentTitle?: string;
	formData: {
		blocks: BlockNoteBlock[];
		tags: string[];
	};
	isEditMode: boolean;
	isLoading: boolean;
	isArchived?: boolean;
	autoSave: {
		saveState: SaveState;
		lastSaved: Date | null;
		hasUnsavedChanges: boolean;
		saveError: Error | null;
		saveNow: () => Promise<void>;
	};
	onTitleChange: (title: string) => void;
	onBlocksChange: (blocks: BlockNoteBlock[]) => void;
	onTagRemove: (tag: string) => void;
	onEditorReady: (editor: EditorHandle) => void;
	onRestore?: () => void;
	isRestoring?: boolean;
	onRegisterToggleSidebar?: (handler: () => void) => void;
	/** Navigate to another page — used by breadcrumbs to return to the dashboard */
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	/** In-document find bar controls (Ctrl+F). */
	find?: DocumentFindControls;
	/** External change conflict state */
	hasConflict?: boolean;
	onReloadFromDisk?: () => void;
	onKeepMine?: () => void;
	/** Ref to the find bar for external refocus/seed control. */
	findBarRef?: React.RefObject<{ setQuery: (q: string) => void; focusInput: () => void } | null>;
	/** Whether the document outline panel is open. */
	isOutlineOpen?: boolean;
	/** Callback to close the document outline panel. */
	onCloseOutline?: () => void;
}

const PinButton: React.FC<{
	documentPath: string;
	documentTitle: string;
	projectAlias?: string;
}> = ({ documentPath, documentTitle, projectAlias = "" }) => {
	const pinned = useSidebarStateStore((s) => s.pinnedDocuments.some((d) => d.path === documentPath));
	const pinDocument = useSidebarStateStore((s) => s.pinDocument);
	const unpinDocument = useSidebarStateStore((s) => s.unpinDocument);

	const toggle = useCallback(() => {
		if (pinned) {
			unpinDocument(documentPath);
		} else {
			pinDocument({ path: documentPath, title: documentTitle, projectAlias });
		}
	}, [pinned, documentPath, documentTitle, projectAlias, pinDocument, unpinDocument]);

	return (
		<button
			type="button"
			onClick={toggle}
			title={pinned ? "Unpin document" : "Pin to sidebar"}
			aria-label={pinned ? "Unpin document" : "Pin to sidebar"}
			aria-pressed={pinned}
			className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-text-dim hover:text-text-bright hover:bg-glass-bg/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent transition-colors"
		>
			{pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
			{pinned ? "Pinned" : "Pin"}
		</button>
	);
};

export const DocumentContent: React.FC<DocumentContentProps> = React.memo(
	({
		sidebarSections,
		currentProject,
		documentPath,
		documentTitle,
		formData,
		isEditMode,
		isLoading,
		isArchived = false,
		autoSave,
		onTitleChange,
		onBlocksChange,
		onTagRemove,
		onEditorReady,
		onRestore,
		isRestoring = false,
		onRegisterToggleSidebar,
		onNavigate,
		find,
		hasConflict = false,
		onReloadFromDisk,
		onKeepMine,
		findBarRef: externalFindBarRef,
		isOutlineOpen = false,
		onCloseOutline,
	}) => {
		const breadcrumbs = currentProject
			? [
					{ label: currentProject.name, onClick: () => onNavigate?.("dashboard") },
					{ label: documentTitle || "Document" },
				]
			: undefined;

		const pinAction =
			documentPath && documentTitle ? (
				<PinButton
					documentPath={documentPath}
					documentTitle={documentTitle}
					projectAlias={currentProject?.alias}
				/>
			) : undefined;

		const [counts, setCounts] = useState({
			wordCount: 0,
			charCount: 0,
			selectionCount: undefined as number | undefined,
		});

		const handleCountChange = useCallback(
			(newCounts: { wordCount: number; charCount: number; selectionCount?: number }) => {
				setCounts(newCounts);
			},
			[],
		);

		const findBarRef = externalFindBarRef ?? React.useRef(null);

		const editorRef = useRef<EditorHandle | null>(null);
		const handleEditorReadyWithRef = useCallback(
			(editor: EditorHandle) => {
				editorRef.current = editor;
				onEditorReady(editor);
			},
			[onEditorReady],
		);

		return (
			<Layout
				sidebarSections={sidebarSections}
				currentPage="document"
				breadcrumbs={breadcrumbs}
				headerActions={pinAction}
				onRegisterToggleSidebar={onRegisterToggleSidebar}
			>
				<div className="flex flex-col w-full h-full">
					{/* Page header with mode icon */}
					<div className="px-4 pt-4 pb-2 border-b border-glass-border">
						<div className="flex items-center gap-2">
							<FileText
								className="w-5 h-5"
								style={{ color: "var(--mode-accent)" }}
								aria-hidden="true"
								data-testid="page-header-icon"
							/>
							<span className="text-sm text-text-dim">Document</span>
						</div>
					</div>
					{isArchived && (
						<div className="flex flex-wrap items-center gap-3 border-b border-accent/30 bg-accent/10 px-6 py-3 text-xs uppercase tracking-widest text-accent">
							<span className="font-semibold">Archived Document</span>
							<span className="text-text-dim normal-case">Restore to resume editing.</span>
							{onRestore && (
								<Button
									variant="primary"
									size="sm"
									onClick={onRestore}
									disabled={isRestoring}
									className="ml-auto text-xs font-semibold uppercase tracking-widest"
								>
									{isRestoring ? "Restoring..." : "Restore"}
								</Button>
							)}
						</div>
					)}
					{hasConflict && <ConflictBanner onKeepMine={onKeepMine} onReloadFromDisk={onReloadFromDisk} />}
				<DocumentEditorForm
					blocks={formData.blocks}
					tags={formData.tags}
					isEditMode={isEditMode}
					isLoading={isLoading}
					isReadOnly={isArchived}
					onTitleChange={onTitleChange}
					onBlocksChange={onBlocksChange}
					onTagRemove={onTagRemove}
					onEditorReady={handleEditorReadyWithRef}
					find={find}
					onNavigate={onNavigate}
					onCountChange={handleCountChange}
					findBarRef={findBarRef}
				/>

				<DocumentEditorActions
					saveState={autoSave.saveState}
					lastSaved={autoSave.lastSaved}
					hasUnsavedChanges={autoSave.hasUnsavedChanges}
					saveError={autoSave.saveError}
					isArchived={isArchived}
					wordCount={counts.wordCount}
					charCount={counts.charCount}
					selectionCount={counts.selectionCount}
				/>
			</div>
			<DocumentOutline
				editor={editorRef.current}
				blocks={formData.blocks}
				isOpen={isOutlineOpen}
				onClose={onCloseOutline ?? (() => {})}
			/>
		</Layout>
		);
	},
);

DocumentContent.displayName = "DocumentContent";
