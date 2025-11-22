import type React from "react";
import { StatusBar } from "../components/ui";
import { DocumentList } from "../components/DocumentList";
import { Layout } from "../components/Layout";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useHotkeys } from "../hooks";
import { useDashboardController } from "./dashboard/useDashboardController";

interface DashboardProps {
	onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
	onRegisterToggleArchived?: (handler: () => void) => void;
	getShowArchived?: () => boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onRegisterToggleArchived }) => {
	const controller = useDashboardController({
		onNavigate,
		onRegisterToggleArchived,
	});

	useHotkeys(controller.hotkeys);

	const isLoading = controller.projectsLoading || controller.documentsLoading;
	const {
		documents,
		sidebarSections,
		commandInput,
		setCommandInput,
		commandInputRef,
		handleCommandSubmit,
		handleDocumentClick,
		documentList,
		showArchived,
		clearSelection,
		confirmDialog,
		setConfirmDialog,
		statusBar,
		currentProjectAlias,
	} = controller;

	return (
		<>
			<Layout
				sidebarSections={sidebarSections}
				currentPage="dashboard"
				showCommandLine={true}
				commandContext={currentProjectAlias ?? undefined}
				commandPlaceholder="what did you ship today?"
				commandValue={commandInput}
				onCommandChange={setCommandInput}
				onCommandSubmit={handleCommandSubmit}
				commandInputRef={commandInputRef}
			>
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<div className="text-text-dim">Loading...</div>
					</div>
				) : (
					<div className="flex h-full flex-col overflow-hidden">
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
