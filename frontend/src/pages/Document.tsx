import React, {
  useCallback,
  useMemo,
  useState,
  useRef,
  useEffect,
} from "react";
import {
  DocumentLoadingState,
  DocumentErrorState,
  DocumentContent,
} from "../components/document";
import { useSidebarSections } from "../hooks/useSidebarSections";
import { useProjectContext } from "../contexts";
import { useHotkeys, useHelp } from "../hooks";
import { useDocumentForm } from "../hooks/useDocumentForm";
import { useDocumentInitialization } from "../hooks/useDocumentInitialization";
import { useDocumentPersistence } from "../hooks/useDocumentPersistence";
import { useDocumentEditor } from "../hooks/useDocumentEditor";
import { useNotification } from "../hooks/useNotification";
import { useDocumentEscapeHandling } from "../hooks/useDocumentEscapeHandling";
import { createEmptyDocument } from "../utils/documentBlockUtils";
import { ParseWithDocument } from "../../wailsjs/go/commandline/DocumentCommands";
import { GetDocumentTags } from "../../wailsjs/go/tag/Service";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import { HelpCommand } from "../types";
import { BlockNoteEditor } from "@blocknote/core";

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

interface DocumentProps {
  onNavigate?: (
    page: string,
    state?: Record<string, string | number | boolean | undefined>,
  ) => void;
  documentPath?: string;
  initialTitle?: string;
}

export const Document: React.FC<DocumentProps> = ({
  onNavigate,
  documentPath,
  initialTitle,
}) => {
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

  const { isLoading, loadError, shouldAutoSave, resetAutoSave } =
    useDocumentInitialization({
      documentPath,
      initialTitle,
      initializeForm,
    });

  const { handleEditorReady } = useDocumentEditor();

  const [commandInput, setCommandInput] = useState("");
  const commandInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<BlockNoteEditor | null>(null);

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
    hasChanges,
    currentProject,
    documentPath,
    isEditMode,
    isLoading,
    shouldAutoSave,
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

  const handleCommandSubmit = useCallback(
    async (command: string) => {
      if (!documentPath) {
        error("No document open");
        return;
      }

      try {
        const result = await ParseWithDocument(command, documentPath);

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
    [documentPath],
  );

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

  useHotkeys([
    {
      key: "mod+s",
      handler: () => {
        autoSave.saveNow();
      },
      allowInInput: true,
      description: "Save document",
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
      handler: () => {
        const editor = editorRef.current;
        if (editor && !editor.isFocused()) {
          editor.focus();
        }
      },
      allowInInput: false,
      description: "Focus editor when unfocused",
    },
  ]);

  const sidebarSections = useSidebarSections({
    currentPage: "document",
    onNavigate,
  });

  console.log('[Document] Render state:', {
    documentPath,
    initialTitle,
    isEditMode,
    isLoading,
    loadError: loadError || null,
    hasFormData: !!formData,
    formDataBlocksCount: formData?.blocks?.length || 0,
  });

  if (isLoading) {
    console.log('[Document] Rendering DocumentLoadingState');
    return <DocumentLoadingState sidebarSections={sidebarSections} />;
  }

  if (loadError && isEditMode) {
    console.log('[Document] Rendering DocumentErrorState');
    return (
      <DocumentErrorState
        sidebarSections={sidebarSections}
        onNavigate={onNavigate}
      />
    );
  }

  console.log('[Document] Rendering DocumentContent');
  return (
    <DocumentContent
      sidebarSections={sidebarSections}
      currentProject={currentProject}
      formData={formData}
      isEditMode={isEditMode}
      isLoading={isLoading}
      autoSave={autoSave}
      commandInput={commandInput}
      onCommandChange={setCommandInput}
      onCommandSubmit={handleCommandSubmit}
      onTitleChange={setTitle}
      onBlocksChange={setBlocks}
      onTagRemove={removeTag}
      onEditorReady={handleEditorReadyWithRef}
      onCancel={handleCancel}
    />
  );
};
