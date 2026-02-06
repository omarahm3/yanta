import { type RefObject, useCallback } from "react";
import { ParseWithContext } from "../../../bindings/yanta/internal/commandline/documentcommands";
import { ExportDocumentRequest } from "../../../bindings/yanta/internal/document/models";
import { ExportDocument } from "../../../bindings/yanta/internal/document/service";
import { ExportRequest } from "../../../bindings/yanta/internal/export";
import { ExportToPDF } from "../../../bindings/yanta/internal/export/service";
import { OpenDirectoryDialog } from "../../../bindings/yanta/internal/system/service";
import type { Document } from "../../types/Document";
import type { Project } from "../../types/Project";
import type { NavigationState } from "../../types";
import { preprocessCommand } from "../../utils/commandPreprocessor";

interface DashboardCommandHandlerOptions {
	documents: Document[];
	selectedDocuments: Set<string>;
	currentProject: Project | null | undefined;
	reloadDocuments: () => Promise<void>;
	clearSelection: () => void;
	onNavigate?: (page: string, state?: NavigationState) => void;
	success: (message: string) => void;
	error: (message: string) => void;
	setCommandInput: (value: string) => void;
	commandInputRef: RefObject<HTMLInputElement>;
	onConfirmationRequired?: (data: {
		title: string;
		message: string;
		confirmationCommand: string;
		danger?: boolean;
		inputPrompt?: string;
		expectedInput?: string;
		showCheckbox?: boolean;
	}) => void;
}

export const useDashboardCommandHandler = ({
	documents,
	selectedDocuments,
	currentProject,
	reloadDocuments,
	clearSelection,
	onNavigate,
	success,
	error,
	setCommandInput,
	commandInputRef,
	onConfirmationRequired,
}: DashboardCommandHandlerOptions) => {
	const handleCommandSubmit = useCallback(
		async (command: string) => {
			if (!currentProject) {
				error("No project selected");
				return;
			}

			try {
				const commandTrimmed = command.trim();
				const withoutPrefix = commandTrimmed.startsWith(":")
					? commandTrimmed.slice(1).trimStart()
					: commandTrimmed;
				if (!withoutPrefix) {
					error("Empty command");
					return;
				}

				const selectedPathsInOrder = documents
					.filter((doc) => selectedDocuments.has(doc.path))
					.map((doc) => doc.path);

				const preprocessedCommand = preprocessCommand(withoutPrefix, documents, selectedPathsInOrder);
				const baseCommand = withoutPrefix.split(/\s+/)[0]?.toLowerCase() ?? "";
				const result = await ParseWithContext(preprocessedCommand, currentProject.alias);

				if (!result) {
					error("Command returned null");
					return;
				}

				if (!result.success) {
					if (result.message) error(result.message);
					return;
				}

				if (
					result.data?.requiresConfirmation &&
					result.data.confirmationCommand &&
					onConfirmationRequired
				) {
					const isHard = result.data.flags?.includes("--hard") ?? false;
					const isArchive = withoutPrefix.startsWith("archive ");
					const isDelete = withoutPrefix.startsWith("delete ");

					let title = "Confirm Action";
					let message = result.message || "Confirm this action?";
					let danger = false;
					let inputPrompt: string | undefined;
					let expectedInput: string | undefined;
					let showCheckbox = false;

					if (isArchive) {
						title = "Archive Document";
						message = result.message || "Archive this document?";
						danger = false;
					} else if (isDelete) {
						if (isHard) {
							title = "Permanently Delete Document";
							message =
								result.message ||
								"This will PERMANENTLY delete the document. This action CANNOT be undone!";
							showCheckbox = true;
							danger = true;
						} else {
							title = "Delete Document";
							message = result.message || "Delete this document?";
							danger = false;
						}
					}

					commandInputRef.current?.blur();
					onConfirmationRequired({
						title,
						message,
						confirmationCommand: result.data.confirmationCommand,
						danger,
						inputPrompt,
						expectedInput,
						showCheckbox,
					});
					return;
				}

				const actions: Record<string, () => Promise<void>> = {
					"navigate to new document": async () => {
						onNavigate?.("document", {
							initialTitle: result.data?.title,
						});
					},
					"navigate to document": async () => {
						onNavigate?.("document", {
							documentPath: result.data?.documentPath,
						});
					},
					"document archived": async () => {
						await reloadDocuments();
						clearSelection();
					},
					"document unarchived": async () => {
						await reloadDocuments();
						clearSelection();
					},
					"document deleted": async () => {
						await reloadDocuments();
						clearSelection();
					},
					"document permanently deleted": async () => {
						await reloadDocuments();
						clearSelection();
						success("Document permanently deleted");
					},
					"export document": async () => {
						const docPath = result.data?.documentPath;
						if (!docPath) {
							error("No document path provided");
							return;
						}
						const outputDir = await OpenDirectoryDialog();
						if (!outputDir) {
							return;
						}
						const documentName = docPath.split("/").pop()?.replace(".json", ".md") || "document.md";
						const outputPath = `${outputDir}/${documentName}`;
						const req = new ExportDocumentRequest({
							DocumentPath: docPath,
							OutputPath: outputPath,
						});
						await ExportDocument(req);
					},
					"export to PDF": async () => {
						const docPath = result.data?.documentPath;
						if (!docPath) {
							error("No document path provided");
							return;
						}
						const outputDir = await OpenDirectoryDialog();
						if (!outputDir) {
							return;
						}
						const documentName = docPath.split("/").pop()?.replace(".json", ".pdf") || "document.pdf";
						const outputPath = `${outputDir}/${documentName}`;
						const req = new ExportRequest({
							DocumentPath: docPath,
							OutputPath: outputPath,
						});
						await ExportToPDF(req);
					},
				};

				const action = result.message ? actions[result.message] : undefined;
				if (action) {
					await action();
				} else if (result.message) {
					const shouldReloadForCommand = ["archive", "unarchive", "delete"].includes(baseCommand);
					if (shouldReloadForCommand) {
						await reloadDocuments();
						clearSelection();
					} else if (result.message.includes("permanently deleted")) {
						await reloadDocuments();
						clearSelection();
					}
					success(result.message);
				}
			} catch (err) {
				error(err instanceof Error ? err.message : "Command failed");
			} finally {
				setCommandInput("");
				commandInputRef.current?.blur();
			}
		},
		[
			currentProject,
			documents,
			selectedDocuments,
			error,
			onNavigate,
			reloadDocuments,
			clearSelection,
			success,
			setCommandInput,
			commandInputRef,
			onConfirmationRequired,
		],
	);

	return { handleCommandSubmit };
};
