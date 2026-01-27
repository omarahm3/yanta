import { type RefObject, useCallback } from "react";
import { ParseWithContext } from "../../../bindings/yanta/internal/commandline/documentcommands";
import type { Document } from "../../types/Document";
import type { Project } from "../../types/Project";
import { preprocessCommand } from "../../utils/commandPreprocessor";

interface DashboardCommandHandlerOptions {
	documents: Document[];
	selectedDocuments: Set<string>;
	currentProject: Project | null | undefined;
	reloadDocuments: () => Promise<void>;
	clearSelection: () => void;
	onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
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
						success("Document archived");
					},
					"document unarchived": async () => {
						await reloadDocuments();
						clearSelection();
						success("Document unarchived");
					},
					"document deleted": async () => {
						await reloadDocuments();
						clearSelection();
						success("Document deleted");
					},
					"document permanently deleted": async () => {
						await reloadDocuments();
						clearSelection();
						success("Document permanently deleted");
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
