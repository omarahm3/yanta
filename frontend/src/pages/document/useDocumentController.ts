import type { BlockNoteEditor } from "@blocknote/core";
import { Events } from "@wailsio/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ParseWithDocument } from "../../../bindings/yanta/internal/commandline/documentcommands";
import { GetDocumentTags } from "../../../bindings/yanta/internal/tag/service";
import type { DocumentContentProps } from "../../components/document/DocumentContent";
import { useProjectContext } from "../../contexts";
import { useHelp } from "../../hooks";
import { useDocumentEditor } from "../../hooks/useDocumentEditor";
import { useDocumentEscapeHandling } from "../../hooks/useDocumentEscapeHandling";
import { useDocumentForm } from "../../hooks/useDocumentForm";
import { useDocumentInitialization } from "../../hooks/useDocumentInitialization";
import { useDocumentPersistence } from "../../hooks/useDocumentPersistence";
import { useNotification } from "../../hooks/useNotification";
import { useSidebarSections } from "../../hooks/useSidebarSections";
import { DocumentServiceWrapper } from "../../services/DocumentService";
import type { HelpCommand } from "../../types";
import type { HotkeyConfig } from "../../types/hotkeys";
import { createEmptyDocument } from "../../utils/documentBlockUtils";

const helpCommands: HelpCommand[] = [
	{
		command: "tag <tag1> [tag2] [tag3...]",
		description: "Add tags to the current document (space or comma-separated)",
	},
	{
		command: "untag <tag>",
		description: "Remove a specific tag from the current document",
	},
	{
		command: "untag *",
		description: "Remove all tags from the current document",
	},
	{
		command: "tags",
		description: "List all tags on the current document",
	},
];

export interface DocumentControllerOptions {
	onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
	documentPath?: string;
	initialTitle?: string;
}

export interface DocumentControllerResult {
	isLoading: boolean;
	showError: boolean;
	sidebarSections: ReturnType<typeof useSidebarSections>;
	contentProps: DocumentContentProps;
	hotkeys: HotkeyConfig[];
}

export function useDocumentController({
	onNavigate,
	documentPath,
	initialTitle,
}: DocumentControllerOptions): DocumentControllerResult {
	const { currentProject } = useProjectContext();
	const { success, error } = useNotification();
	const { setPageContext } = useHelp();
	const isEditMode = !!documentPath;

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

	const [commandInput, setCommandInput] = useState("");
	const commandInputRef = useRef<HTMLInputElement>(null);
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
			handleEditorReady(editor);
			setIsEditorReady(true);
		},
		[handleEditorReady],
	);

	useEffect(() => {
		setPageContext(helpCommands, "Document");
	}, [setPageContext]);

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
			if (autoSaveRef.current.hasUnsavedChanges && !isArchivedRef.current && currentProjectRef.current) {
				autoSaveRef.current.saveNow().catch((err) => {
					console.error("[Document] Failed to save on unmount:", err);
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
	});

	const focusEditor = useCallback(() => {
		const editor = editorRef.current;
		if (editor && !editor.isFocused()) {
			editor.focus();
		}
	}, []);

	const handleCommandSubmit = useCallback(
		async (command: string) => {
			const trimmedCommand = command.trim();
			if (!documentPath) {
				error("No document open");
				return;
			}
			const withoutPrefix = trimmedCommand.startsWith(":")
				? trimmedCommand.slice(1).trimStart()
				: trimmedCommand;
			if (!withoutPrefix) {
				error("Empty command");
				return;
			}
			const normalizedCommand = withoutPrefix.toLowerCase();
			const isUnarchiveCommand =
				normalizedCommand === "unarchive" || normalizedCommand.startsWith("unarchive ");
			if (isArchived && !isUnarchiveCommand) {
				error("Restore the document before running commands.");
				return;
			}

			try {
				const result = await ParseWithDocument(withoutPrefix, documentPath);

				if (!result) {
					error("Command returned null");
					return;
				}

				if (!result.success) {
					if (result.message) error(result.message);
					return;
				}

				const actions: Record<string, () => void> = {
					"tags added": () => {
						success(result.message);
					},
					"tags removed": () => {
						success(result.message);
					},
					"current tags": () => {
						success(result.message);
					},
					"document unarchived": () => {
						setHasRestored(true);
						success("Document unarchived");
					},
				};

				const action = actions[result.message];
				if (action) {
					action();
				} else if (result.message) {
					success(result.message);
				}
			} catch (err) {
				error(err instanceof Error ? err.message : "Command failed");
			} finally {
				setCommandInput("");
				commandInputRef.current?.blur();
			}
		},
		[documentPath, error, isArchived, success],
	);

	const handleRestore = useCallback(async () => {
		if (!documentPath || isRestoring) {
			return;
		}
		setIsRestoring(true);
		try {
			await DocumentServiceWrapper.restore(documentPath);
			setHasRestored(true);
			success("Document restored");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to restore document";
			error(message);
		} finally {
			setIsRestoring(false);
		}
	}, [documentPath, error, isRestoring, success]);

	useEffect(() => {
		const refreshTags = async () => {
			if (!documentPath) return;

			try {
				const currentTags = await GetDocumentTags(documentPath);
				setTags(currentTags);
			} catch (err) {
				console.error("Failed to refresh tags:", err);
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
		commandInput,
		onCommandChange: setCommandInput,
		onCommandSubmit: handleCommandSubmit,
		onTitleChange: setTitle,
		onBlocksChange: setBlocks,
		onTagRemove: removeTag,
		onEditorReady: handleEditorReadyWithRef,
		onRestore: isArchived ? handleRestore : undefined,
	};

	const saveNow = autoSave.saveNow;

	const hotkeys: HotkeyConfig[] = useMemo(
		() => [
			{
				key: "mod+s",
				handler: (event: KeyboardEvent) => {
					event.preventDefault();
					event.stopPropagation();
					if (isArchived) {
						error("Restore the document before editing.");
						return;
					}
					void saveNow();
				},
				allowInInput: true,
				description: "Save document",
				capture: true,
			},
			{
				key: "Escape",
				handler: handleEscape,
				allowInInput: false,
				description: "Navigate back when editor is not focused",
			},
			{
				key: "mod+C",
				handler: handleUnfocus,
				allowInInput: true,
				description: "Unfocus editor",
			},
			{
				key: "Enter",
				handler: focusEditor,
				allowInInput: false,
				description: "Focus editor when unfocused",
			},
		],
		[saveNow, error, focusEditor, handleEscape, handleUnfocus, isArchived],
	);

	return {
		isLoading,
		showError: Boolean(loadError && isEditMode),
		sidebarSections,
		contentProps,
		hotkeys,
	};
}
