import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ParseWithContext } from "../../../bindings/yanta/internal/commandline/documentcommands";
import { ExportDocumentRequest } from "../../../bindings/yanta/internal/document/models";
import {
	ExportDocument,
	Restore,
	SoftDelete,
} from "../../../bindings/yanta/internal/document/service";
import { ExportRequest } from "../../../bindings/yanta/internal/export";
import { ExportToPDF } from "../../../bindings/yanta/internal/export/service";
import { OpenDirectoryDialog } from "../../../bindings/yanta/internal/system/service";
import { DocumentCommand } from "../../constants";
import { DASHBOARD_SHORTCUTS } from "../../config";
import { useDocumentContext, useProjectContext } from "../../contexts";
import { useHelp } from "../../hooks";
import { useNotification } from "../../hooks/useNotification";
import { useRecentDocuments } from "../../hooks/useRecentDocuments";
import { useSidebarSections } from "../../hooks/useSidebarSections";
import { DocumentServiceWrapper, moveDocumentToProject } from "../../services/DocumentService";
import type { Document } from "../../types/Document";
import type { HotkeyConfig } from "../../types/hotkeys";
import type { NavigationState } from "../../types";
import { useDashboardCommandHandler } from "./useDashboardCommandHandler";

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

export interface ConfirmDialogState {
	isOpen: boolean;
	title: string;
	message: string;
	onConfirm: () => void;
	danger?: boolean;
	inputPrompt?: string;
	expectedInput?: string;
	showCheckbox?: boolean;
}

export interface MoveDialogState {
	isOpen: boolean;
	documentPaths: string[];
}

export interface DashboardControllerOptions {
	onNavigate?: (page: string, state?: NavigationState) => void;
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
	const { currentProject, isLoading: projectsLoading } = useProjectContext();
	const {
		documents,
		loadDocuments,
		isLoading: documentsLoading,
		selectedIndex: highlightedIndex,
		setSelectedIndex: setHighlightedIndex,
		selectNext: highlightNext,
		selectPrevious: highlightPrevious,
	} = useDocumentContext();

	const [commandInput, setCommandInput] = useState("");
	const commandInputRef = useRef<HTMLInputElement>(null);
	const [showArchived, setShowArchived] = useState(false);
	const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
	const { success, error } = useNotification();
	const { removeRecentDocument } = useRecentDocuments();
	const { setPageContext } = useHelp();
	const sidebarSections = useSidebarSections({
		currentPage: "dashboard",
		onNavigate,
	});
	const currentProjectRef = useRef(currentProject);
	const documentsRef = useRef(documents);
	const selectedDocumentsRef = useRef(selectedDocuments);
	const highlightedIndexRef = useRef(highlightedIndex);
	const showArchivedRef = useRef(showArchived);

	useEffect(() => {
		currentProjectRef.current = currentProject;
		documentsRef.current = documents;
		selectedDocumentsRef.current = selectedDocuments;
		highlightedIndexRef.current = highlightedIndex;
		showArchivedRef.current = showArchived;
	}, [currentProject, documents, selectedDocuments, highlightedIndex, showArchived]);

	useEffect(() => {
		setPageContext(helpCommands, "Documents");
	}, [setPageContext]);

	useEffect(() => {
		if (currentProject) {
			loadDocuments(currentProject.alias, showArchived);
		}
	}, [currentProject, loadDocuments, showArchived]);

	useEffect(() => {
		commandInputRef.current?.blur();
	}, []);

	const clearSelection = useCallback(() => {
		setSelectedDocuments(new Set());
	}, []);

	useEffect(() => {
		setSelectedDocuments(new Set());
	}, []);

	const reloadDocuments = useCallback(async () => {
		if (!currentProjectRef.current) return;
		await loadDocuments(currentProjectRef.current.alias, showArchivedRef.current);
	}, [loadDocuments]);

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

	const handleToggleSelection = useCallback((path?: string) => {
		let targetDoc: Document | null = null;
		if (path) {
			const docIndex = documentsRef.current.findIndex((doc) => doc.path === path);
			if (docIndex !== -1) {
				targetDoc = documentsRef.current[docIndex];
				setHighlightedIndex(docIndex);
			}
		} else if (
			highlightedIndexRef.current >= 0 &&
			highlightedIndexRef.current < documentsRef.current.length
		) {
			targetDoc = documentsRef.current[highlightedIndexRef.current];
		}

		if (!targetDoc) return;

		const docPath = targetDoc.path;

		setSelectedDocuments((prev) => {
			const next = new Set(prev);
			if (next.has(docPath)) {
				next.delete(docPath);
			} else {
				next.add(docPath);
			}
			return next;
		});
	}, []);

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
		const paths = Array.from(selectedDocumentsRef.current);
		if (paths.length === 0) {
			error("No documents selected");
			return;
		}
		await archivePaths(paths);
	}, [archivePaths, error]);

	const handleRestoreSelectedDocuments = useCallback(async () => {
		const paths = Array.from(selectedDocumentsRef.current);
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

	const handleExportSelectedMarkdown = useCallback(async () => {
		const paths = Array.from(selectedDocumentsRef.current);
		if (paths.length === 0) {
			error("No documents selected");
			return;
		}
		try {
			const outputDir = await OpenDirectoryDialog();
			if (!outputDir) {
				return;
			}
			for (const docPath of paths) {
				const documentName = docPath.split("/").pop()?.replace(".json", ".md") || "document.md";
				const outputPath = `${outputDir}/${documentName}`;
				const req = new ExportDocumentRequest({
					DocumentPath: docPath,
					OutputPath: outputPath,
				});
				await ExportDocument(req);
			}
		} catch (err) {
			error(err instanceof Error ? err.message : "Failed to export");
		}
	}, [error]);

	const handleExportSelectedPDF = useCallback(async () => {
		const paths = Array.from(selectedDocumentsRef.current);
		if (paths.length === 0) {
			error("No documents selected");
			return;
		}
		try {
			const outputDir = await OpenDirectoryDialog();
			if (!outputDir) {
				return;
			}
			for (const docPath of paths) {
				const documentName = docPath.split("/").pop()?.replace(".json", ".pdf") || "document.pdf";
				const outputPath = `${outputDir}/${documentName}`;
				const req = new ExportRequest({
					DocumentPath: docPath,
					OutputPath: outputPath,
				});
				await ExportToPDF(req);
			}
		} catch (err) {
			error(err instanceof Error ? err.message : "Failed to export");
		}
	}, [error]);

	const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
		isOpen: false,
		title: "",
		message: "",
		onConfirm: () => {},
	});

	const [moveDialog, setMoveDialog] = useState<MoveDialogState>({
		isOpen: false,
		documentPaths: [],
	});

	const handleMoveSelectedDocuments = useCallback(() => {
		let paths = Array.from(selectedDocumentsRef.current);
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
	}, [error]);

	const handleMoveDone = useCallback(async () => {
		await reloadDocuments();
		clearSelection();
	}, [reloadDocuments, clearSelection]);

	const closeMoveDialog = useCallback(() => {
		setMoveDialog({ isOpen: false, documentPaths: [] });
	}, []);

	const handleDeleteSelectedDocuments = useCallback(
		(hard: boolean) => {
			const selectedPaths = Array.from(selectedDocumentsRef.current);
			if (selectedPaths.length === 0) {
				error(hard ? "No documents selected to permanently delete" : "No documents selected to delete");
				return;
			}

			const count = selectedPaths.length;

			if (count === 1) {
				const doc = documentsRef.current.find((d) => d.path === selectedPaths[0]);
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
				} else if (selectedDocumentsRef.current.size > 0) {
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
						setTimeout(() => commandInputRef.current?.focus(), 0);
					}
				},
			});
		},
	});

	const hotkeys: HotkeyConfig[] = useMemo(
		() => [
			{ ...DASHBOARD_SHORTCUTS.newDocument, handler: handleNewDocument, allowInInput: false },
			{
				...DASHBOARD_SHORTCUTS.toggleArchived,
				handler: handleToggleArchived,
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.softDelete,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleDeleteSelectedDocuments(false);
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.permanentDelete,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleDeleteSelectedDocuments(true);
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.toggleSelection,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleToggleSelection();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.openHighlighted,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleOpenHighlightedDocument();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.highlightNext,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightNext();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.highlightPrev,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightPrevious();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.navigateDown,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightNext();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.navigateUp,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					highlightPrevious();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.move,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					handleMoveSelectedDocuments();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.archive,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handleArchiveSelectedDocuments();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.restore,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handleRestoreSelectedDocuments();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.exportMd,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handleExportSelectedMarkdown();
				},
				allowInInput: false,
			},
			{
				...DASHBOARD_SHORTCUTS.exportPdf,
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					void handleExportSelectedPDF();
				},
				allowInInput: false,
			},
		],
		[
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
		],
	);

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
