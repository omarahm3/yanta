import { Archive, FilePlus } from "lucide-react";
import React, { useRef, useState } from "react";
import { GranularErrorBoundary, Layout } from "@/app";
import { formatShortcutKeyForDisplay } from "@/config/shortcuts";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import { useHotkeys } from "../hotkeys";
import type { NavigationState, PageName } from "../shared/types";
import { Button } from "../shared/ui";
import { ConfirmDialog } from "../shared/ui/ConfirmDialog";
import { DocumentList } from "./components/DocumentList";
import { DocumentListSkeleton } from "./components/DocumentListSkeleton";
import { FirstRunOnboarding } from "./components/FirstRunOnboarding";
import { MoveDocumentDialog } from "./components/MoveDocumentDialog";
import { StatusBar } from "./components/StatusBar";
import { useDashboardController } from "./hooks/useDashboardController";
import { useDocumentSort } from "./hooks/useDocumentSort";

interface DashboardProps {
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	onRegisterToggleArchived?: (handler: () => void) => void;
	getShowArchived?: () => boolean;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

const DashboardComponent: React.FC<DashboardProps> = ({
	onNavigate,
	onRegisterToggleArchived,
	onRegisterToggleSidebar,
}) => {
	const controller = useDashboardController({
		onNavigate,
		onRegisterToggleArchived,
	});

	useHotkeys(controller.hotkeys);
	const [documentListKey, setDocumentListKey] = useState(0);
	const documentListScrollRef = useRef<HTMLDivElement>(null);
	const isLoading = controller.projectsLoading || controller.documentsLoading;

	const { shortcuts } = useMergedConfig();
	const newDocKey = formatShortcutKeyForDisplay(shortcuts.dashboard.newDocument.key);
	const archivedKey = formatShortcutKeyForDisplay(shortcuts.dashboard.toggleArchived.key);
	const {
		documents: rawDocuments,
		sidebarSections,
		handleDocumentClick,
		documentList,
		showArchived,
		clearSelection,
		confirmDialog,
		setConfirmDialog,
		moveDialog,
		handleMoveDone,
		closeMoveDialog,
		statusBar,
		isVaultEmpty,
		creatingFirstNote,
		handleCreateFirstNote,
		handleStartFirstProject,
	} = controller;

	const { sort, setSort, sortedDocuments: documents } = useDocumentSort(rawDocuments);

	const headerActions = (
		<div className="flex items-center gap-2">
			<Button
				variant="ghost"
				size="sm"
				onClick={controller.handleToggleArchived}
				aria-pressed={showArchived}
				title={`${showArchived ? "Show active documents" : "Show archived documents"} (${archivedKey})`}
				className={showArchived ? "text-accent" : undefined}
			>
				<Archive className="h-4 w-4" aria-hidden="true" />
				<span className="ml-1.5">{showArchived ? "Archived" : "Archive"}</span>
			</Button>
			<Button
				variant="primary"
				size="sm"
				onClick={controller.handleNewDocument}
				title={`New document (${newDocKey})`}
			>
				<FilePlus className="h-4 w-4" aria-hidden="true" />
				<span className="ml-1.5">New</span>
			</Button>
		</div>
	);

	return (
		<>
			<Layout
				sidebarSections={sidebarSections}
				currentPage="dashboard"
				headerActions={headerActions}
				onRegisterToggleSidebar={onRegisterToggleSidebar}
				hasSelection={documentList.selectedDocuments.size > 0}
				documentCount={documents.length}
			>
				{isLoading ? (
					<div className="flex h-full flex-col overflow-hidden">
						<div className="flex-1 overflow-y-auto p-4">
							<DocumentListSkeleton />
						</div>
					</div>
				) : isVaultEmpty ? (
					<FirstRunOnboarding
						onCreateNote={handleCreateFirstNote}
						onCreateProject={handleStartFirstProject}
						isCreating={creatingFirstNote}
					/>
				) : (
					<div className="flex h-full flex-col overflow-hidden">
						<div ref={documentListScrollRef} className="flex-1 overflow-y-auto p-4">
							<GranularErrorBoundary
								key={documentListKey}
								message="Something went wrong in the document list."
								onRetry={() => setDocumentListKey((k) => k + 1)}
							>
								<DocumentList
									documents={documents}
									onDocumentClick={handleDocumentClick}
									highlightedIndex={documentList.highlightedIndex}
									onHighlightDocument={documentList.setHighlightedIndex}
									selectedDocuments={documentList.selectedDocuments}
									onToggleSelection={documentList.handleToggleSelection}
									scrollRef={documentListScrollRef}
									onArchiveDocument={controller.handleArchiveDocument}
									onRestoreDocument={controller.handleRestoreDocument}
									onMoveDocument={controller.handleOpenMoveDialog}
									showArchived={showArchived}
									currentProjectAlias={controller.currentProjectAlias}
									hasProjects={controller.hasProjects}
									onCreateDocument={controller.handleNewDocument}
									onShowProjects={() => onNavigate?.("projects")}
									onShowActiveDocuments={controller.handleToggleArchived}
								/>
							</GranularErrorBoundary>
						</div>
						<StatusBar
							totalEntries={statusBar.totalEntries}
							currentContext={statusBar.currentContext}
							showArchived={showArchived}
							selectedCount={statusBar.selectedCount}
							onClearSelection={statusBar.selectedCount > 0 ? clearSelection : undefined}
							onExportSelectedMarkdown={
								statusBar.selectedCount > 0 ? controller.handleExportSelectedMarkdown : undefined
							}
							onExportSelectedPDF={
								statusBar.selectedCount > 0 ? controller.handleExportSelectedPDF : undefined
							}
							onArchiveSelected={
								statusBar.selectedCount > 0 && !showArchived
									? () => void controller.handleArchiveSelectedDocuments()
									: undefined
							}
							onRestoreSelected={
								statusBar.selectedCount > 0 && showArchived
									? () => void controller.handleRestoreSelectedDocuments()
									: undefined
							}
							onMoveSelected={
								statusBar.selectedCount > 0 ? controller.handleMoveSelectedDocuments : undefined
							}
							onDeleteSelected={
								statusBar.selectedCount > 0 ? controller.handleDeleteSelectedDocuments : undefined
							}
							sortField={sort.field}
							sortDirection={sort.direction}
							onSortChange={setSort}
						/>
					</div>
				)}
			</Layout>
			<MoveDocumentDialog
				isOpen={moveDialog.isOpen}
				onClose={closeMoveDialog}
				documentPaths={moveDialog.documentPaths}
				currentProjectAlias={controller.currentProjectAlias ?? ""}
				onMoved={handleMoveDone}
			/>
			<ConfirmDialog
				isOpen={confirmDialog.isOpen}
				title={confirmDialog.title}
				message={confirmDialog.message}
				onConfirm={confirmDialog.onConfirm}
				onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
				danger={confirmDialog.danger}
				inputPrompt={confirmDialog.inputPrompt}
				expectedInput={confirmDialog.expectedInput}
				showCheckbox={confirmDialog.showCheckbox}
			/>
		</>
	);
};

export const Dashboard = React.memo(DashboardComponent);
