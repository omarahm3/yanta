import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlockNoteEditor } from "@blocknote/core";
import { useHelp } from "../../hooks";
import { useNotification } from "../../hooks/useNotification";
import { useDocumentEscapeHandling } from "../../hooks/useDocumentEscapeHandling";
import { useDocumentEditor } from "../../hooks/useDocumentEditor";
import { useDocumentForm } from "../../hooks/useDocumentForm";
import { useDocumentInitialization } from "../../hooks/useDocumentInitialization";
import { useDocumentPersistence } from "../../hooks/useDocumentPersistence";
import { useSidebarSections } from "../../hooks/useSidebarSections";
import { useProjectContext } from "../../contexts";
import { createEmptyDocument } from "../../utils/documentBlockUtils";
import { ParseWithDocument } from "../../../wailsjs/go/commandline/DocumentCommands";
import { GetDocumentTags } from "../../../wailsjs/go/tag/Service";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { HelpCommand } from "../../types";
import { DocumentServiceWrapper } from "../../services/DocumentService";
import { DocumentContentProps } from "../../components/document/DocumentContent";
import { HotkeyConfig } from "../../types/hotkeys";

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
  onNavigate?: (
    page: string,
    state?: Record<string, string | number | boolean | undefined>,
  ) => void;
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

  const { data, isLoading, loadError, shouldAutoSave, resetAutoSave } =
    useDocumentInitialization({
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
  const isArchived = Boolean(data?.deletedAt) && !hasRestored;

  useEffect(() => {
    setHasRestored(false);
    setIsRestoring(false);
  }, [documentPath]);

  useEffect(() => {
    if (!data?.deletedAt) {
      setHasRestored(false);
    }
  }, [data?.deletedAt, documentPath]);

  const handleEditorReadyWithRef = useCallback(
    (editor: BlockNoteEditor) => {
      editorRef.current = editor;
      handleEditorReady(editor);
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
  });

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
        normalizedCommand === "unarchive" ||
        normalizedCommand.startsWith("unarchive ");
      if (isArchived && !isUnarchiveCommand) {
        error("Restore the document before running commands.");
        return;
      }

      try {
        const result = await ParseWithDocument(withoutPrefix, documentPath);

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
      const message =
        err instanceof Error ? err.message : "Failed to restore document";
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

    const unsubscribe = EventsOn("yanta/document/tags", (data: any) => {
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
    onCancel: handleCancel,
    onRestore: isArchived ? handleRestore : undefined,
  };

  const hotkeys: HotkeyConfig[] = [
    {
      key: "mod+s",
      handler: (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (isArchived) {
          error("Restore the document before editing.");
          return;
        }
        void autoSave.saveNow();
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
  ];

  return {
    isLoading,
    showError: Boolean(loadError && isEditMode),
    sidebarSections,
    contentProps,
    hotkeys,
  };
}
