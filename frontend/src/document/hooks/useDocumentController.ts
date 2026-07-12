import { Events } from "@wailsio/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GetDocumentTags } from "../../../bindings/yanta/internal/tag/service";
import type { EditorHandle } from "../../editor/types";
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
import { getSelectedText } from "../utils/editorSelection";
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
	loadError: string | null;
	reload: () => void;
	sidebarSections: ReturnType<typeof useSidebarSections>;
	contentProps: DocumentContentProps;
	hotkeys: HotkeyConfig[];
	/** The document title from the form state. */
	documentTitle: string;
	/** Used by PaneDocumentView for direct Escape handler (double-ESC → dashboard). */
	escapeHandler: (e: KeyboardEvent) => void;
	/** True when the file was modified externally and the user must choose to reload or keep. */
	hasConflict: boolean;
	/** Accept the external changes and reload the document. */
	onReloadFromDisk: () => void;
	/** Dismiss the conflict banner and keep the current editor content. */
	onKeepMine: () => void;
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

	const {
		data,
		isLoading,
		loadError,
		reload,
		shouldAutoSave,
		resetAutoSave,
		documentHash,
		refreshHash,
		updateDocumentHash,
	} = useDocumentInitialization({
		documentPath,
		initialTitle,
		initializeForm,
	});

	const [hasConflict, setHasConflict] = useState(false);

	const { handleEditorReady } = useDocumentEditor();
	const { addRecentDocument } = useRecentDocuments();
	const { handleExportToMarkdown, handleExportToPDF } = useDocumentExports({
		documentPath,
		documentTitle: formData.title,
	});

	const editorRef = useRef<EditorHandle | null>(null);
	const lastAddedPathRef = useRef<string | null>(null);
	const [hasRestored, setHasRestored] = useState(false);
	const [isRestoring, setIsRestoring] = useState(false);
	const [isEditorReady, setIsEditorReady] = useState(false);
	const [isFindOpen, setFindOpen] = useState(false);
	const [isReplaceOpen, setReplaceOpen] = useState(false);
	const [isOutlineOpen, setOutlineOpen] = useState(false);
	const lastQueryRef = useRef<string>("");
	const findBarRef = useRef<{ setQuery: (q: string) => void; focusInput: () => void } | null>(null);

	const openFind = useCallback(
		(query?: string) => {
			if (isFindOpen) {
				// Find is already open - refocus and optionally seed from selection or passed query
				const editor = editorRef.current;
				if (editor && findBarRef.current) {
					if (query) {
						findBarRef.current.setQuery(query);
						lastQueryRef.current = query;
					} else {
						const selectionText = getSelectedText(editor);
						if (selectionText.trim()) {
							findBarRef.current.setQuery(selectionText);
							lastQueryRef.current = selectionText;
						}
					}
					findBarRef.current.focusInput();
				}
			} else {
				setFindOpen(true);
				if (query && findBarRef.current) {
					findBarRef.current.setQuery(query);
					lastQueryRef.current = query;
				}
			}
		},
		[isFindOpen],
	);
	const openReplace = useCallback(() => {
		setFindOpen(true);
		setReplaceOpen(true);
	}, []);
	const toggleReplace = useCallback(() => {
		setFindOpen(true);
		setReplaceOpen((prev) => !prev);
	}, []);
	const closeFind = useCallback(() => {
		setFindOpen(false);
		setReplaceOpen(false);
	}, []);

	const handleRefocus = useCallback((seedFromSelection?: boolean) => {
		const editor = editorRef.current;
		if (!editor || !findBarRef.current) return;

		if (seedFromSelection) {
			const selectionText = getSelectedText(editor);
			if (selectionText.trim()) {
				findBarRef.current.setQuery(selectionText);
				lastQueryRef.current = selectionText;
			}
		}
		findBarRef.current.focusInput();
	}, []);
	// Close the find bar when switching to a different document.
	useEffect(() => {
		setFindOpen(false);
		setReplaceOpen(false);
	}, [documentPath]);
	const isArchived = Boolean(data?.deletedAt) && !hasRestored;

	useEffect(() => {
		setHasRestored(false);
		setIsRestoring(false);
		setIsEditorReady(false);
		setHasConflict(false);
		lastAddedPathRef.current = null;
	}, [documentPath]);

	useEffect(() => {
		if (!data?.deletedAt) {
			setHasRestored(false);
		}
	}, [data?.deletedAt]);

	const handleEditorReadyWithRef = useCallback(
		(editor: EditorHandle) => {
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
		hasChanges: isArchived || Boolean(loadError) || hasConflict ? false : hasChanges,
		currentProject,
		documentPath,
		isEditMode,
		isLoading: isLoading || Boolean(loadError),
		shouldAutoSave: !isArchived && shouldAutoSave,
		resetChanges,
		onAutoSaveComplete: resetAutoSave,
		isEditorReady,
		onNewDocumentSaved: incrementDocumentsCreated,
		documentHash,
		onConflict: () => setHasConflict(true),
		onSaveComplete: (newHash) => {
			updateDocumentHash(newHash);
			setHasConflict(false);
		},
	});

	const autoSaveRef = useRef(autoSave);
	const isArchivedRef = useRef(isArchived);
	const currentProjectRef = useRef(currentProject);

	useEffect(() => {
		autoSaveRef.current = autoSave;
		isArchivedRef.current = isArchived;
		currentProjectRef.current = currentProject;
	});

	const saveNowForHotkey = useCallback(async () => {
		if (loadError) {
			error("Document could not be loaded.");
			return;
		}
		return autoSaveRef.current.saveNow();
	}, [error, loadError]);

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

	const deleteBlock = useCallback(() => {
		const editor = editorRef.current;
		if (!editor) return;

		const selection = editor.getSelection();
		if (selection && selection.blocks.length > 0) {
			editor.removeBlocks(selection.blocks);
		} else {
			const cursor = editor.getTextCursorPosition();
			if (cursor?.block) {
				editor.removeBlocks([cursor.block]);
			}
		}
	}, []);

	const moveBlockUp = useCallback(() => {
		const editor = editorRef.current;
		if (!editor) return;
		editor.moveBlocksUp();
	}, []);

	const moveBlockDown = useCallback(() => {
		const editor = editorRef.current;
		if (!editor) return;
		editor.moveBlocksDown();
	}, []);

	const duplicateBlock = useCallback(() => {
		const editor = editorRef.current;
		if (!editor) return;

		const selection = editor.getSelection();
		const cursorBlock = editor.getTextCursorPosition()?.block;
		const blocksToDuplicate =
			selection && selection.blocks.length > 0 ? selection.blocks : cursorBlock ? [cursorBlock] : [];

		if (blocksToDuplicate.length === 0) return;

		// Duplicate by inserting copies after the last block
		const lastBlock = blocksToDuplicate[blocksToDuplicate.length - 1];
		const copies = blocksToDuplicate.map((block) => ({
			...block,
			id: undefined, // Let BlockNote generate new IDs
		}));
		editor.insertBlocks(copies, lastBlock, "after");
	}, []);

	const toggleOutline = useCallback(() => {
		setOutlineOpen((prev) => !prev);
	}, []);

	const hotkeys = useDocumentHotkeysConfig({
		isActivePaneRef,
		isArchived,
		error,
		saveNow: saveNowForHotkey,
		handleExportToMarkdown,
		handleExportToPDF,
		handleEscape,
		handleUnfocus,
		focusEditor,
		openFind,
		openReplace,
		deleteBlock,
		moveBlockUp,
		moveBlockDown,
		duplicateBlock,
		toggleOutline,
		editorRef,
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

	// Register command-palette / global document handlers. Only the active pane
	// registers: the store keeps a single module-level handler per command, so an
	// unconditional register would let the last-mounted pane clobber the focused
	// one — routing Save/Find/Replace/Restore to the wrong document.
	useEffect(() => {
		if (!isActivePane) return;
		const handleSaveRequest = () => {
			if (isArchivedRef.current) {
				error("Restore the document before saving.");
				return;
			}
			if (loadError) {
				error("Document could not be loaded.");
				return;
			}
			autoSaveRef.current.saveNow().catch((err) => {
				BackendLogger.error("[Document] Failed to save from command palette:", err);
				error("Failed to save document");
			});
		};
		const store = useDocumentCommandStore.getState();
		store.registerSaveHandler(handleSaveRequest);
		store.registerFindHandler(openFind);
		store.registerReplaceHandler(openReplace);
		store.registerRestoreHandler(handleRestore);
		return () => {
			const s = useDocumentCommandStore.getState();
			s.registerSaveHandler(null);
			s.registerFindHandler(null);
			s.registerReplaceHandler(null);
			s.registerRestoreHandler(null);
		};
	}, [error, loadError, openFind, openReplace, handleRestore, isActivePane]);

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

		const unsubscribeTags = Events.On("yanta/document/tags", (ev) => {
			const data = ev.data as { path?: string };
			if (data?.path === documentPath) {
				refreshTags();
			}
		});

		const unsubscribeExternalChange = Events.On("yanta/entry/external-change", (ev) => {
			const data = ev.data as { path?: string };
			if (data?.path === documentPath) {
				setHasConflict(true);
			}
		});

		return () => {
			if (unsubscribeTags) unsubscribeTags();
			if (unsubscribeExternalChange) unsubscribeExternalChange();
		};
	}, [documentPath, setTags]);

	const handleReloadFromDisk = useCallback(async () => {
		if (!documentPath) return;
		try {
			const doc = await DocumentServiceWrapper.get(documentPath);
			initializeForm({
				title: doc.title,
				blocks: doc.blocks,
				tags: doc.tags,
			});
			await refreshHash();
			setHasConflict(false);
		} catch (err) {
			BackendLogger.error("Failed to reload document from disk:", err);
		}
	}, [documentPath, initializeForm, refreshHash]);

	const handleKeepMine = useCallback(async () => {
		await refreshHash();
		setHasConflict(false);
	}, [refreshHash]);

	const sidebarSections = useSidebarSections({
		currentPage: "document",
		onNavigate,
		onOpenDocument: (path) => onNavigate?.("document", { documentPath: path }),
	});

	const contentProps: DocumentContentProps = {
		sidebarSections,
		currentProject,
		documentPath,
		documentTitle: formData.title,
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
		onNavigate,
		find: {
			isOpen: isFindOpen,
			onClose: closeFind,
			showReplace: isReplaceOpen,
			onToggleReplace: toggleReplace,
			onRefocus: handleRefocus,
		},
		hasConflict,
		onReloadFromDisk: handleReloadFromDisk,
		onKeepMine: handleKeepMine,
		findBarRef,
		isOutlineOpen,
		onCloseOutline: () => setOutlineOpen(false),
	};

	return {
		isLoading,
		showError: Boolean(loadError && isEditMode),
		loadError,
		reload,
		sidebarSections,
		contentProps,
		hotkeys,
		documentTitle: formData.title,
		escapeHandler: handleEscape,
		hasConflict,
		onReloadFromDisk: handleReloadFromDisk,
		onKeepMine: handleKeepMine,
	};
}
