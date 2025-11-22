import type { BlockNoteEditor } from "@blocknote/core";
import React from "react";
import type { SaveState } from "../../hooks/useAutoSave";
import type { BlockNoteBlock } from "../../types/Document";
import type { Project } from "../../types/Project";
import { Layout } from "../Layout";
import { Button, type SidebarSection } from "../ui";
import { DocumentEditorActions } from "./DocumentEditorActions";
import { DocumentEditorForm } from "./DocumentEditorForm";

export interface DocumentContentProps {
	sidebarSections: SidebarSection[];
	currentProject: Project | undefined;
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
	commandInput: string;
	onCommandChange: (value: string) => void;
	onCommandSubmit: (command: string) => void;
	onTitleChange: (title: string) => void;
	onBlocksChange: (blocks: BlockNoteBlock[]) => void;
	onTagRemove: (tag: string) => void;
	onEditorReady: (editor: BlockNoteEditor) => void;
	onRestore?: () => void;
	isRestoring?: boolean;
}

export const DocumentContent: React.FC<DocumentContentProps> = React.memo(
	({
		sidebarSections,
		currentProject,
		formData,
		isEditMode,
		isLoading,
		isArchived = false,
		autoSave,
		commandInput,
		onCommandChange,
		onCommandSubmit,
		onTitleChange,
		onBlocksChange,
		onTagRemove,
		onEditorReady,
		onRestore,
		isRestoring = false,
	}) => (
		<Layout
			sidebarSections={sidebarSections}
			currentPage={currentProject?.alias ?? "document"}
			showCommandLine={true}
			commandContext="document"
			commandPlaceholder=":tag web frontend | :untag react | :tags"
			commandValue={commandInput}
			onCommandChange={onCommandChange}
			onCommandSubmit={onCommandSubmit}
		>
			<div className="flex flex-col w-full h-full">
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
				<DocumentEditorForm
					blocks={formData.blocks}
					tags={formData.tags}
					isEditMode={isEditMode}
					isLoading={isLoading}
					isReadOnly={isArchived}
					onTitleChange={onTitleChange}
					onBlocksChange={onBlocksChange}
					onTagRemove={onTagRemove}
					onEditorReady={onEditorReady}
				/>

				<DocumentEditorActions
					saveState={autoSave.saveState}
					lastSaved={autoSave.lastSaved}
					hasUnsavedChanges={autoSave.hasUnsavedChanges}
					saveError={autoSave.saveError}
					isArchived={isArchived}
				/>
			</div>
		</Layout>
	),
);

DocumentContent.displayName = "DocumentContent";
