import { useCallback, useEffect, useRef, useState } from "react";
import { DocumentCommand } from "@/config/public";
import { ParseWithContext } from "../../../bindings/yanta/internal/commandline/documentcommands";
import { Restore, SoftDelete } from "../../../bindings/yanta/internal/document/service";
import { useDocumentContext } from "../../document";
import { useHelp } from "../../help";
import { useNotification, useRecentDocuments, useSidebarSections } from "../../shared/hooks";
import { DocumentServiceWrapper } from "../../shared/services/DocumentService";
import type { NavigationState, PageName } from "../../shared/types";
import type { Document } from "../../shared/types/Document";
import type { HotkeyConfig } from "../../shared/types/hotkeys";
import { useDashboardCommandHandler } from "./useDashboardCommandHandler";
import { useDashboardData } from "./useDashboardData";
import {
	type ConfirmDialogState,
	type MoveDialogState,
	useDashboardDialogs,
} from "./useDashboardDialogs";
import { useDashboardExports } from "./useDashboardExports";
import { useDashboardHotkeysConfig } from "./useDashboardHotkeysConfig";
import { useDashboardSelection } from "./useDashboardSelection";

export type { ConfirmDialogState, MoveDialogState };

const helpCommands = [
	{
		command: `${DocumentCommand.DocumentCommandNew} [text]`,
		description: "Create a new document in the current project",
	},
	{
		command: `${DocumentCommand.DocumentCommandDoc} <index>`,
		description: "Open a document by number (e.g., 'doc 3')",
	},
	{
		command: `${DocumentCommand.DocumentCommandArchive} <index>`,
		description: "Archive a document by number (e.g., 'archive 2')",
	},
	{
		command: `${DocumentCommand.DocumentCommandUnarchive} <index>`,
		description: "Unarchive a document by number",
	},
	{
		command: `${DocumentCommand.DocumentCommandDelete} <index>`,
		description: "Soft delete a document (can be restored)",
	},
	{
		command: `${DocumentCommand.DocumentCommandDelete} <index> --force --hard`,
		description: "PERMANENT deletion - removes from vault (requires --force and cannot be undone)",
	},
	{
		command: `${DocumentCommand.DocumentCommandDelete} <index1>,<index2>,... --force --hard`,
		description: "Permanently delete multiple (e.g., 'delete 1,3,5 --force --hard')",
	},
];

export interface DashboardControllerOptions {
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	onRegisterToggleArchived?: (handler: () => void) => void;
}

export interface DashboardControllerResult {
	projectsLoading: boolean;
	documentsLoading: boolean;
	documents: Document[];
	currentProjectAlias: string | null;
	sidebarSections: ReturnType<typeof useSidebarSections>;
	commandInput: string;
	setCommandInput: (value: string) => void;
	commandInputRef: React.RefObject<HTMLInputElement>;
	handleCommandSubmit: (command: string) => Promise<void>;
	handleDocumentClick: (path: string) => void;
	documentList: {
		highlightedIndex: number;
		setHighlightedIndex: (index: number) => void;
		selectedDocuments: Set<string>;
		handleToggleSelection: (path?: string) => void;
	};
	showArchived: boolean;
	handleToggleArchived: () => void;
	clearSelection: () => void;
	handleArchiveSelectedDocuments: () => Promise<void>;
	handleRestoreSelectedDocuments: () => Promise<void>;
	handleArchiveDocument: (path: string) => Promise<void>;
	handleRestoreDocument: (path: string) => Promise<void>;
	handleOpenMoveDialog: (path: string) => void;
	handleDeleteSelectedDocuments: (hard: boolean) => void;
	handleExportSelectedMarkdown: () => Promise<void>;
	handleExportSelectedPDF: () => Promise<void>;
	confirmDialog: ConfirmDialogState;
	setConfirmDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState>>;
	moveDialog: MoveDialogState;
	handleMoveSelectedDocuments: () => void;
	handleMoveDone: () => void;
	closeMoveDialog: () => void;
	statusBar: {
		totalEntries: number;
		currentContext: string;
		selectedCount: number;
	};
	hotkeys: HotkeyConfig[];
}

export function useDashboardController({
	onNavigate,
	onRegisterToggleArchived,
}: DashboardControllerOptions): DashboardControllerResult {
	const [showArchived, setShowArchived] = useState(false);
	const { projectsLoading, documentsLoading, documents, currentProject, reloadDocuments } =
		useDashboardData({ showArchived });

	const {
		selectedIndex: highlightedIndex,
		setSelectedIndex: setHighlightedIndex,
		selectNext: highlightNext,
		selectPrevious: highlightPrevious,
	} = useDocumentContext();

	const [commandInput, setCommandInput] = useState("");
	const commandInputRef = useRef<HTMLInputElement>(null);
	const currentProjectRef = useRef(currentProject);
	const documentsRef = useRef(documents);
	const documentsByPathRef = useRef(new Map<string, Document>());
	const highlightedIndexRef = useRef(highlightedIndex);
	const showArchivedRef = useRef(showArchived);

	const { selectedDocuments, selectedDocumentsRef, handleToggleSelection, clearSelection } =
		useDashboardSelection({
			documentsRef,
			highlightedIndexRef,
			setHighlightedIndex,
		});

	const { confirmDialog, setConfirmDialog, moveDialog, setMoveDialog, closeMoveDialog } =
		useDashboardDialogs();

	const { success, error } = useNotification();
	const { removeRecentDocument } = useRecentDocuments();
	const { setPageContext } = useHelp();
	const sidebarSections = useSidebarSections({
		currentPage: "dashboard",
		onNavigate,
	});

	const { handleExportSelectedMarkdown, handleExportSelectedPDF } = useDashboardExports({
		selectedDocumentsRef,
		error,
	});

	useEffect(() => {
		currentProjectRef.current = currentProject;
		documentsRef.current = documents;
		const byPath = new Map<string, Document>();
		for (const doc of documents) {
			byPath.set(doc.path, doc);
		}
		documentsByPathRef.current = byPath;
		highlightedIndexRef.current = highlightedIndex;
		showArchivedRef.current = showArchived;
	}, [currentProject, documents, highlightedIndex, showArchived]);

	useEffect(() => {
		setPageContext(helpCommands, "Documents");
	}, [setPageContext]);

	useEffect(() => {
		commandInputRef.current?.blur();
	}, []);

	const handleDocumentClick = useCallback(
		(path: string) => {
			onNavigate?.("document", { documentPath: path });
		},
		[onNavigate],
	);

	const handleNewDocument = useCallback(async () => {
		if (!currentProjectRef.current) {
			error("No project selected");
			return;
		}
		try {
			const newPath = await DocumentServiceWrapper.save({
				projectAlias: currentProjectRef.current.alias,
				title: "Untitled",
				blocks: [
					{
						id: "initial-heading",
						type: "heading",
						props: { level: 1 },
						content: [{ type: "text", text: "", styles: {} }],
					},
				],
				tags: [],
			});
			onNavigate?.("document", { documentPath: newPath, newDocument: true });
		} catch (err) {
			error(`Failed to create document: ${err}`);
		}
	}, [onNavigate, error]);

	const handleToggleArchived = useCallback(() => {
		setShowArchived((prev) => !prev);
	}, []);

	useEffect(() => {
		if (onRegisterToggleArchived) {
			onRegisterToggleArchived(handleToggleArchived);
		}
	}, [onRegisterToggleArchived, handleToggleArchived]);

	const archivePaths = useCallback(
		async (paths: string[]) => {
			try {
				for (const path of paths) {
					await SoftDelete(path);
					removeRecentDocument(path);
				}
				await reloadDocuments();
				clearSelection();
			} catch (err) {
				error(err instanceof Error ? err.message : "Failed to archive");
			}
		},
		[clearSelection, reloadDocuments, error, removeRecentDocument],
	);

	const handleArchiveSelectedDocuments = useCallback(async () => {
		const paths = Array.from(selectedDocumentsRef.current ?? []);
		if (paths.length === 0) {
			error("No documents selected");
			return;
		}
		await archivePaths(paths);
	}, [archivePaths, error]);

	const handleRestoreSelectedDocuments = useCallback(async () => {
		const paths = Array.from(selectedDocumentsRef.current ?? []);
		if (paths.length === 0) {
			error("No documents selected");
			return;
		}
		try {
			for (const path of paths) {
				await Restore(path);
			}
			await reloadDocuments();
			clearSelection();
		} catch (err) {
			error(err instanceof Error ? err.message : "Failed to restore");
		}
	}, [reloadDocuments, clearSelection, error]);

	const handleArchiveDocument = useCallback(
		async (path: string) => {
			await archivePaths([path]);
		},
		[archivePaths],
	);

	const handleRestoreDocument = useCallback(
		async (path: string) => {
			try {
				await Restore(path);
				await reloadDocuments();
				clearSelection();
			} catch (err) {
				error(err instanceof Error ? err.message : "Failed to restore");
			}
		},
		[reloadDocuments, clearSelection, error],
	);

	const handleOpenMoveDialog = useCallback((path: string) => {
		setMoveDialog({ isOpen: true, documentPaths: [path] });
	}, []);

	const handleMoveSelectedDocuments = useCallback(() => {
		let paths = Array.from(selectedDocumentsRef.current ?? []);
		if (
			paths.length === 0 &&
			highlightedIndexRef.current >= 0 &&
			highlightedIndexRef.current < documentsRef.current.length
		) {
			const doc = documentsRef.current[highlightedIndexRef.current];
			if (doc) {
				paths = [doc.path];
			}
		}
		if (paths.length === 0) {
			error("No documents selected to move");
			return;
		}
		setMoveDialog({ isOpen: true, documentPaths: paths });
	}, [error, setMoveDialog]);

	const handleMoveDone = useCallback(async () => {
		await reloadDocuments();
		clearSelection();
	}, [reloadDocuments, clearSelection]);

	const handleDeleteSelectedDocuments = useCallback(
		(hard: boolean) => {
			const selectedPaths = Array.from(selectedDocumentsRef.current ?? []);
			if (selectedPaths.length === 0) {
				error(hard ? "No documents selected to permanently delete" : "No documents selected to delete");
				return;
			}

			const count = selectedPaths.length;

			if (count === 1) {
				const doc = documentsByPathRef.current.get(selectedPaths[0]);
				if (!doc) {
					error("Unable to find selected document");
					return;
				}

				if (hard) {
					commandInputRef.current?.blur();
					setConfirmDialog({
						isOpen: true,
						title: "Permanently Delete Document",
						message: `This will PERMANENTLY delete "${doc.title}" from the vault. This action CANNOT be undone!`,
						onConfirm: async () => {
							try {
								const result = await ParseWithContext(
									`delete ${doc.path} --force --hard`,
									currentProjectRef.current?.alias || "",
								);
								if (!result) {
									error("Command returned null");
								} else if (!result.success) {
									error(result.message || "Failed to delete");
								} else {
									await reloadDocuments();
									clearSelection();
									success("Document permanently deleted");
								}
							} catch (err) {
								error(err instanceof Error ? err.message : "Failed to permanently delete");
							} finally {
								setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
							}
						},
						danger: true,
						showCheckbox: true,
					});
				} else {
					commandInputRef.current?.blur();
					setConfirmDialog({
						isOpen: true,
						title: "Delete Document",
						message: `This will soft delete "${doc.title}". You can restore it later from archived view.`,
						onConfirm: async () => {
							try {
								await SoftDelete(doc.path);
								removeRecentDocument(doc.path);
								await reloadDocuments();
								clearSelection();
							} catch (err) {
								error(err instanceof Error ? err.message : "Failed to delete");
							} finally {
								setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
							}
						},
					});
				}
			} else {
				if (hard) {
					commandInputRef.current?.blur();
					setConfirmDialog({
						isOpen: true,
						title: "Permanently Delete Multiple Documents",
						message: `This will PERMANENTLY delete ${count} document${
							count > 1 ? "s" : ""
						} from the vault. This action CANNOT be undone!`,
						onConfirm: async () => {
							try {
								const pathsString = selectedPaths.join(",");
								const result = await ParseWithContext(
									`delete ${pathsString} --force --hard`,
									currentProjectRef.current?.alias || "",
								);
								if (!result) {
									error("Command returned null");
								} else if (!result.success) {
									error(result.message || "Failed to delete");
								} else {
									await reloadDocuments();
									clearSelection();
									success(`${count} documents permanently deleted`);
								}
							} catch (err) {
								error(err instanceof Error ? err.message : "Failed to permanently delete");
							} finally {
								setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
							}
						},
						danger: true,
						showCheckbox: true,
					});
				} else {
					commandInputRef.current?.blur();
					setConfirmDialog({
						isOpen: true,
						title: "Delete Multiple Documents",
						message: `This will soft delete ${count} document${
							count > 1 ? "s" : ""
						}. You can restore them later from archived view.`,
						onConfirm: async () => {
							try {
								for (const path of selectedPaths) {
									await SoftDelete(path);
									removeRecentDocument(path);
								}
								await reloadDocuments();
								clearSelection();
							} catch (err) {
								error(err instanceof Error ? err.message : "Failed to delete");
							} finally {
								setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
							}
						},
					});
				}
			}
		},
		[error, reloadDocuments, clearSelection, success, removeRecentDocument],
	);

	const handleOpenHighlightedDocument = useCallback(() => {
		if (
			highlightedIndexRef.current < 0 ||
			highlightedIndexRef.current >= documentsRef.current.length
		) {
			return;
		}
		const doc = documentsRef.current[highlightedIndexRef.current];
		if (doc) {
			handleDocumentClick(doc.path);
		}
	}, [handleDocumentClick]);

	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (confirmDialog.isOpen) {
					setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
				} else if ((selectedDocumentsRef.current?.size ?? 0) > 0) {
					clearSelection();
				}
			}
		};
		window.addEventListener("keydown", handleEsc);
		return () => window.removeEventListener("keydown", handleEsc);
	}, [confirmDialog.isOpen, clearSelection]);

	const { handleCommandSubmit } = useDashboardCommandHandler({
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
		onConfirmationRequired: (data) => {
			commandInputRef.current?.blur();
			setConfirmDialog({
				isOpen: true,
				title: data.title,
				message: data.message,
				danger: data.danger,
				inputPrompt: data.inputPrompt,
				expectedInput: data.expectedInput,
				showCheckbox: data.showCheckbox,
				onConfirm: async () => {
					try {
						if (!currentProjectRef.current) return;
						const result = await ParseWithContext(
							data.confirmationCommand,
							currentProjectRef.current.alias,
						);
						if (!result) {
							error("Command returned null");
						} else if (result.success) {
							await reloadDocuments();
							clearSelection();
							if (result.message) success(result.message);
						} else {
							if (result.message) error(result.message);
						}
					} catch (err) {
						error(err instanceof Error ? err.message : "Command failed");
					} finally {
						setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
						queueMicrotask(() => commandInputRef.current?.focus());
					}
				},
			});
		},
	});

	const hotkeys: HotkeyConfig[] = useDashboardHotkeysConfig({
		handleNewDocument,
		handleToggleArchived,
		handleDeleteSelectedDocuments,
		handleMoveSelectedDocuments,
		handleToggleSelection,
		handleOpenHighlightedDocument,
		highlightNext,
		highlightPrevious,
		handleArchiveSelectedDocuments,
		handleRestoreSelectedDocuments,
		handleExportSelectedMarkdown,
		handleExportSelectedPDF,
	});

	return {
		projectsLoading,
		documentsLoading,
		documents,
		currentProjectAlias: currentProject?.alias ?? null,
		sidebarSections,
		commandInput,
		setCommandInput,
		commandInputRef,
		handleCommandSubmit,
		handleDocumentClick,
		documentList: {
			highlightedIndex,
			setHighlightedIndex,
			selectedDocuments,
			handleToggleSelection,
		},
		showArchived,
		handleToggleArchived,
		clearSelection,
		handleArchiveSelectedDocuments,
		handleRestoreSelectedDocuments,
		handleArchiveDocument,
		handleRestoreDocument,
		handleOpenMoveDialog,
		handleDeleteSelectedDocuments,
		handleExportSelectedMarkdown,
		handleExportSelectedPDF,
		confirmDialog,
		setConfirmDialog,
		moveDialog,
		handleMoveSelectedDocuments,
		handleMoveDone,
		closeMoveDialog,
		statusBar: {
			totalEntries: documents.length,
			currentContext: currentProject?.alias ?? "UNKNOWN",
			selectedCount: selectedDocuments.size,
		},
		hotkeys,
	};
}
