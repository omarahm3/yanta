import type { BlockNoteEditor } from "@blocknote/core";
import { Events } from "@wailsio/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GetDocumentTags } from "../../../bindings/yanta/internal/tag/service";
import { useHelp } from "../../help";
import { useUserProgressContext } from "../../onboarding";
import { usePaneLayout } from "../../pane";
import { useProjectContext } from "../../project";
import { useNotification, useRecentDocuments, useSidebarSections } from "../../shared/hooks";
import { DocumentServiceWrapper } from "../../shared/services/DocumentService";
import { useDocumentCommandStore } from "../../shared/stores/documentCommand.store";
import type { NavigationState, PageName } from "../../shared/types";
import type { HotkeyConfig } from "../../shared/types/hotkeys";
import { BackendLogger } from "../../shared/utils/backendLogger";
import type { DocumentContentProps } from "../components/DocumentContent";
import { createEmptyDocument } from "../utils/documentBlockUtils";
import { useDocumentEditor } from "./useDocumentEditor";
import { useDocumentEscapeHandling } from "./useDocumentEscapeHandling";
import { useDocumentExports } from "./useDocumentExports";
import { useDocumentForm } from "./useDocumentForm";
import { useDocumentHotkeysConfig } from "./useDocumentHotkeysConfig";
import { useDocumentInitialization } from "./useDocumentInitialization";
import { useDocumentPersistence } from "./useDocumentPersistence";

export interface DocumentControllerOptions {
	onNavigate?: (page: PageName, state?: NavigationState) => void;
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
	const { handleExportToMarkdown, handleExportToPDF } = useDocumentExports({
		documentPath,
		documentTitle: formData.title,
	});

	const editorRef = useRef<BlockNoteEditor | null>(null);
	const lastAddedPathRef = useRef<string | null>(null);
	const [hasRestored, setHasRestored] = useState(false);
	const [isRestoring, setIsRestoring] = useState(false);
	const [isEditorReady, setIsEditorReady] = useState(false);
	const isArchived = Boolean(data?.deletedAt) && !hasRestored;

	useEffect(() => {
		setHasRestored(false);
		setIsRestoring(false);
		setIsEditorReady(false);
		lastAddedPathRef.current = null;
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

	// Track recently opened documents (guard prevents duplicate calls when deps change)
	useEffect(() => {
		if (!data || !documentPath || isLoading || loadError || !currentProject) return;
		if (lastAddedPathRef.current === documentPath) return;
		lastAddedPathRef.current = documentPath;
		addRecentDocument({
			path: documentPath,
			title: data.title || "Untitled",
			projectAlias: currentProject.alias,
		});
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

	// Register save handler for command palette / global "Save Document"
	useEffect(() => {
		const handleSaveRequest = () => {
			if (isArchivedRef.current) {
				error("Restore the document before saving.");
				return;
			}
			autoSaveRef.current.saveNow().catch((err) => {
				BackendLogger.error("[Document] Failed to save from command palette:", err);
				error("Failed to save document");
			});
		};
		useDocumentCommandStore.getState().registerSaveHandler(handleSaveRequest);
		return () => {
			useDocumentCommandStore.getState().registerSaveHandler(null);
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

	const hotkeys = useDocumentHotkeysConfig({
		isActivePaneRef,
		isArchived,
		error,
		saveNow: autoSave.saveNow,
		handleExportToMarkdown,
		handleExportToPDF,
		handleEscape,
		handleUnfocus,
		focusEditor,
	});

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
