import React, { useRef, useState } from "react";
import { GranularErrorBoundary, Layout } from "@/app";
import { useHotkeys } from "../hotkeys";
import type { NavigationState, PageName } from "../shared/types";
import { ConfirmDialog } from "../shared/ui/ConfirmDialog";
import { DocumentList } from "./components/DocumentList";
import { MoveDocumentDialog } from "./components/MoveDocumentDialog";
import { StatusBar } from "./components/StatusBar";
import { useDashboardController } from "./hooks/useDashboardController";

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
	const {
		documents,
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
	} = controller;

	return (
		<>
			<Layout
				sidebarSections={sidebarSections}
				currentPage="dashboard"
				onRegisterToggleSidebar={onRegisterToggleSidebar}
			>
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<div className="text-text-dim">Loading...</div>
					</div>
				) : (
					<div className="flex h-full flex-col overflow-hidden">
						<div ref={documentListScrollRef} className="flex-1 overflow-y-auto p-5">
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
