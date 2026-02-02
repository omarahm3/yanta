import { FileText } from "lucide-react";
import type React from "react";
import { DocumentList } from "../components/DocumentList";
import { Layout } from "../components/Layout";
import { StatusBar } from "../components/ui";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useHotkeys } from "../hooks";
import { useDashboardController } from "./dashboard/useDashboardController";

interface DashboardProps {
	onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
	onRegisterToggleArchived?: (handler: () => void) => void;
	getShowArchived?: () => boolean;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
	onNavigate,
	onRegisterToggleArchived,
	onRegisterToggleSidebar,
}) => {
	const controller = useDashboardController({
		onNavigate,
		onRegisterToggleArchived,
	});

	useHotkeys(controller.hotkeys);

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
		statusBar,
	} = controller;

	return (
		<>
			<Layout
				sidebarSections={sidebarSections}
				currentPage="dashboard"
				showQuickCreate={true}
				onNavigate={onNavigate}
				onRegisterToggleSidebar={onRegisterToggleSidebar}
			>
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<div className="text-text-dim">Loading...</div>
					</div>
				) : (
					<div className="flex h-full flex-col overflow-hidden">
						{/* Page header with mode icon */}
						<div className="p-4 border-b border-border">
							<div className="flex items-center gap-2">
								<FileText
									className="w-5 h-5"
									style={{ color: "var(--mode-accent)" }}
									aria-hidden="true"
								/>
								<h1 className="text-lg font-semibold">Documents</h1>
							</div>
						</div>
						<div className="flex-1 overflow-y-auto p-5">
							<DocumentList
								documents={documents}
								onDocumentClick={handleDocumentClick}
								highlightedIndex={documentList.highlightedIndex}
								onHighlightDocument={documentList.setHighlightedIndex}
								selectedDocuments={documentList.selectedDocuments}
								onToggleSelection={documentList.handleToggleSelection}
							/>
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
