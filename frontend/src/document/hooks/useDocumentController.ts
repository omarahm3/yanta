import type { BlockNoteEditor } from "@blocknote/core";
import { Dialogs, Events } from "@wailsio/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExportDocumentRequest } from "../../../bindings/yanta/internal/document/models";
import { ExportDocument } from "../../../bindings/yanta/internal/document/service";
import { ExportRequest } from "../../../bindings/yanta/internal/export/models";
import { ExportToPDF } from "../../../bindings/yanta/internal/export/service";
import { GetDocumentTags } from "../../../bindings/yanta/internal/tag/service";
import type { DocumentContentProps } from "../components/DocumentContent";
import { DOCUMENT_SHORTCUTS } from "../../config";
import { useProjectContext, useUserProgressContext } from "../../contexts";
import { useDocumentEditor } from "./useDocumentEditor";
import { useDocumentEscapeHandling } from "./useDocumentEscapeHandling";
import { useDocumentForm } from "./useDocumentForm";
import { useDocumentInitialization } from "./useDocumentInitialization";
import { useDocumentPersistence } from "./useDocumentPersistence";
import { useHelp } from "../../hooks/useHelp";
import { useNotification } from "../../hooks/useNotification";
import { usePaneLayout } from "../../pane";
import { useRecentDocuments } from "../../hooks/useRecentDocuments";
import { useSidebarSections } from "../../hooks/useSidebarSections";
import { DocumentServiceWrapper } from "../../services/DocumentService";
import type { HotkeyConfig } from "../../types/hotkeys";
import type { NavigationState } from "../../types";
import { createEmptyDocument } from "../../utils/documentBlockUtils";
import { BackendLogger } from "../../utils/backendLogger";

export interface DocumentControllerOptions {
	onNavigate?: (page: string, state?: NavigationState) => void;
	documentPath?: string;
	initialTitle?: string;
	onRegisterToggleSidebar?: (handler: () => void) => void;
	paneId?: string;
}

export interface DocumentControllerResult {
	isLoading: boolean;
	showError: boolean;
	sidebarSections: ReturnType<typeof useSidebarSections>;
	contentProps: DocumentContentProps;
	hotkeys: HotkeyConfig[];
	/** The document title from the form state. */
	documentTitle: string;
	/** Used by PaneDocumentView for direct Escape listener (double-ESC → dashboard). */
	escapeHandler: (e: KeyboardEvent) => void;
}

export function useDocumentController({
	onNavigate,
	documentPath,
	initialTitle,
	onRegisterToggleSidebar,
	paneId,
}: DocumentControllerOptions): DocumentControllerResult {
	const { currentProject } = useProjectContext();
	const { incrementDocumentsCreated } = useUserProgressContext();
	const { activePaneId } = usePaneLayout();
	const isActivePane = !paneId || activePaneId === paneId;
	const isActivePaneRef = useRef(isActivePane);
	isActivePaneRef.current = isActivePane;
	const { error } = useNotification();
	const { setPageContext } = useHelp();
	const isEditMode = !!documentPath;

	// Set page context for help modal
	useEffect(() => {
		setPageContext([], "Document");
	}, [setPageContext]);

	const initialFormData = useMemo(
		() => (initialTitle ? createEmptyDocument(initialTitle) : undefined),
		[initialTitle],
	);

	const {
		formData,
		hasChanges,
		setTitle,
		setBlocks,
		removeTag,
		setTags,
		resetChanges,
		initializeForm,
	} = useDocumentForm(initialFormData);

	const { data, isLoading, loadError, shouldAutoSave, resetAutoSave } = useDocumentInitialization({
		documentPath,
		initialTitle,
		initializeForm,
	});

	const { handleEditorReady } = useDocumentEditor();
	const { addRecentDocument } = useRecentDocuments();

	const editorRef = useRef<BlockNoteEditor | null>(null);
	const [hasRestored, setHasRestored] = useState(false);
	const [isRestoring, setIsRestoring] = useState(false);
	const [isEditorReady, setIsEditorReady] = useState(false);
	const isArchived = Boolean(data?.deletedAt) && !hasRestored;

	useEffect(() => {
		setHasRestored(false);
		setIsRestoring(false);
		setIsEditorReady(false);
	}, [documentPath]);

	useEffect(() => {
		if (!data?.deletedAt) {
			setHasRestored(false);
		}
	}, [data?.deletedAt]);

	const handleEditorReadyWithRef = useCallback(
		(editor: BlockNoteEditor) => {
			editorRef.current = editor;
			if (isActivePaneRef.current) {
				handleEditorReady(editor);
			}
			setIsEditorReady(true);
		},
		[handleEditorReady],
	);

	// Track recently opened documents
	useEffect(() => {
		if (data && documentPath && !isLoading && !loadError && currentProject) {
			addRecentDocument({
				path: documentPath,
				title: data.title || "Untitled",
				projectAlias: currentProject.alias,
			});
		}
	}, [data, documentPath, isLoading, loadError, currentProject, addRecentDocument]);

	const { autoSave } = useDocumentPersistence({
		formData,
		hasChanges: isArchived ? false : hasChanges,
		currentProject,
		documentPath,
		isEditMode,
		isLoading,
		shouldAutoSave: !isArchived && shouldAutoSave,
		resetChanges,
		onAutoSaveComplete: resetAutoSave,
		onNavigate,
		isEditorReady,
		onNewDocumentSaved: incrementDocumentsCreated,
	});

	const autoSaveRef = useRef(autoSave);
	const isArchivedRef = useRef(isArchived);
	const currentProjectRef = useRef(currentProject);

	useEffect(() => {
		autoSaveRef.current = autoSave;
		isArchivedRef.current = isArchived;
		currentProjectRef.current = currentProject;
	});

	useEffect(() => {
		return () => {
			if (
				autoSaveRef.current.hasUnsavedChanges &&
				!isArchivedRef.current &&
				currentProjectRef.current
			) {
				autoSaveRef.current.saveNow().catch((err) => {
					BackendLogger.error("[Document] Failed to save on unmount:", err);
				});
			}
		};
	}, []);

	// Listen for save event from command palette
	useEffect(() => {
		const handleSaveEvent = () => {
			if (isArchivedRef.current) {
				error("Restore the document before saving.");
				return;
			}
			autoSaveRef.current.saveNow().catch((err) => {
				BackendLogger.error("[Document] Failed to save from command palette:", err);
				error("Failed to save document");
			});
		};

		window.addEventListener("yanta:document:save", handleSaveEvent);

		return () => {
			window.removeEventListener("yanta:document:save", handleSaveEvent);
		};
	}, [error]);

	const handleCancel = useCallback(() => {
		if (autoSave.hasUnsavedChanges && !isEditMode) {
			return;
		}
		onNavigate?.("dashboard");
	}, [autoSave.hasUnsavedChanges, isEditMode, onNavigate]);

	const { handleEscape, handleUnfocus } = useDocumentEscapeHandling({
		editorRef,
		onNavigateBack: handleCancel,
		isActivePane,
	});

	const focusEditor = useCallback(() => {
		const editor = editorRef.current;
		if (editor && !editor.isFocused()) {
			editor.focus();
		}
	}, []);

	const handleExportToMarkdown = useCallback(async () => {
		if (!documentPath) {
			error("No document open");
			return;
		}
		try {
			const defaultFilename = `${formData.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
			const outputPath = await Dialogs.SaveFile({
				Title: "Export to Markdown",
				Filename: defaultFilename,
				Filters: [
					{
						DisplayName: "Markdown Files",
						Pattern: "*.md",
					},
				],
			});

			if (!outputPath) {
				return;
			}

			await ExportDocument(
				new ExportDocumentRequest({
					DocumentPath: documentPath,
					OutputPath: outputPath,
				}),
			);
		} catch (err) {
			error(err instanceof Error ? err.message : "Failed to export Markdown");
		}
	}, [documentPath, error, formData.title]);

	const handleExportToPDF = useCallback(async () => {
		if (!documentPath) {
			error("No document open");
			return;
		}
		try {
			const defaultFilename = `${formData.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
			const outputPath = await Dialogs.SaveFile({
				Title: "Export to PDF",
				Filename: defaultFilename,
				Filters: [
					{
						DisplayName: "PDF Files",
						Pattern: "*.pdf",
					},
				],
			});

			if (!outputPath) {
				return;
			}

			await ExportToPDF(
				new ExportRequest({
					DocumentPath: documentPath,
					OutputPath: outputPath,
				}),
			);
		} catch (err) {
			error(err instanceof Error ? err.message : "Failed to export PDF");
		}
	}, [documentPath, error, formData.title]);

	const handleRestore = useCallback(async () => {
		if (!documentPath || isRestoring) {
			return;
		}
		setIsRestoring(true);
		try {
			await DocumentServiceWrapper.restore(documentPath);
			setHasRestored(true);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to restore document";
			error(message);
		} finally {
			setIsRestoring(false);
		}
	}, [documentPath, error, isRestoring]);

	useEffect(() => {
		const refreshTags = async () => {
			if (!documentPath) return;

			try {
				const currentTags = await GetDocumentTags(documentPath);
				setTags(currentTags);
			} catch (err) {
				BackendLogger.error("Failed to refresh tags:", err);
			}
		};

		const unsubscribe = Events.On("yanta/document/tags", (ev) => {
			const data = ev.data as { path?: string };
			if (data?.path === documentPath) {
				refreshTags();
			}
		});

		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [documentPath, setTags]);

	const sidebarSections = useSidebarSections({
		currentPage: "document",
		onNavigate,
	});

	const contentProps: DocumentContentProps = {
		sidebarSections,
		currentProject,
		formData,
		isEditMode,
		isLoading,
		isArchived,
		isRestoring,
		autoSave,
		onTitleChange: setTitle,
		onBlocksChange: setBlocks,
		onTagRemove: removeTag,
		onEditorReady: handleEditorReadyWithRef,
		onRestore: isArchived ? handleRestore : undefined,
		onRegisterToggleSidebar,
	};

	const saveNow = autoSave.saveNow;

	const hotkeys: HotkeyConfig[] = useMemo(
		() => [
			{
				...DOCUMENT_SHORTCUTS.save,
				handler: (event: KeyboardEvent) => {
					if (!isActivePaneRef.current) return false;
					event.preventDefault();
					event.stopPropagation();
					if (isArchived) {
						error("Restore the document before editing.");
						return;
					}
					void saveNow();
				},
				allowInInput: true,
				capture: true,
			},
			{
				...DOCUMENT_SHORTCUTS.exportMd,
				handler: (event: KeyboardEvent) => {
					if (!isActivePaneRef.current) return false;
					event.preventDefault();
					event.stopPropagation();
					if (isArchived) {
						error("Restore the document before exporting.");
						return;
					}
					void handleExportToMarkdown();
				},
				allowInInput: true,
				capture: true,
			},
			{
				...DOCUMENT_SHORTCUTS.exportPdf,
				handler: (event: KeyboardEvent) => {
					if (!isActivePaneRef.current) return false;
					event.preventDefault();
					event.stopPropagation();
					if (isArchived) {
						error("Restore the document before exporting.");
						return;
					}
					void handleExportToPDF();
				},
				allowInInput: true,
				capture: true,
			},
			{
				...DOCUMENT_SHORTCUTS.back,
				handler: (event: KeyboardEvent) => {
					if (!isActivePaneRef.current) return false;
					if (event.defaultPrevented) return false;
					handleEscape(event);
				},
				allowInInput: true,
				capture: true,
			},
			{
				...DOCUMENT_SHORTCUTS.unfocus,
				handler: (event: KeyboardEvent) => {
					if (!isActivePaneRef.current) return false;
					handleUnfocus(event);
				},
				allowInInput: true,
			},
			{
				...DOCUMENT_SHORTCUTS.focusEditor,
				handler: () => {
					if (!isActivePaneRef.current) return false;
					focusEditor();
				},
				allowInInput: false,
			},
		],
		[
			saveNow,
			error,
			focusEditor,
			handleEscape,
			handleUnfocus,
			isArchived,
			handleExportToMarkdown,
			handleExportToPDF,
		],
	);

	return {
		isLoading,
		showError: Boolean(loadError && isEditMode),
		sidebarSections,
		contentProps,
		hotkeys,
		documentTitle: formData.title,
		escapeHandler: handleEscape,
	};
}
