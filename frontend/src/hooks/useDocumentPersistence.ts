import { useCallback, useEffect, useRef } from "react";
import { useNotification } from "./useNotification";
import { useDocumentSaver } from "./useDocumentSaver";
import { useAutoSave } from "./useAutoSave";
import { BlockNoteBlock } from "../types/Document";

interface DocumentFormData {
  title: string;
  blocks: BlockNoteBlock[];
  tags: string[];
}

interface UseDocumentPersistenceProps {
  formData: DocumentFormData;
  hasChanges: boolean;
  currentProject: any;
  documentPath?: string;
  isEditMode: boolean;
  isLoading: boolean;
  shouldAutoSave: boolean;
  resetChanges: () => void;
  onAutoSaveComplete: () => void;
  onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
}

export const useDocumentPersistence = ({
  formData,
  hasChanges,
  currentProject,
  documentPath,
  isLoading,
  shouldAutoSave,
  resetChanges,
  onAutoSaveComplete,
  onNavigate,
}: UseDocumentPersistenceProps) => {
  const { success, error } = useNotification();

  const latestFormRef = useRef(formData);
  const currentDocumentPathRef = useRef(documentPath);
  const isSavingRef = useRef(false);

  useEffect(() => {
    latestFormRef.current = formData;
  }, [formData]);

  useEffect(() => {
    currentDocumentPathRef.current = documentPath;
  }, [documentPath]);

  const { save } = useDocumentSaver(
    (successMsg) => {
      success(successMsg);
      resetChanges();
    },
    (errorMsg) => error(errorMsg),
  );

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) {
      return;
    }

    if (!currentProject) {
      error("No project selected");
      return;
    }

    isSavingRef.current = true;

    try {
      const currentFormData = latestFormRef.current;
      const currentPath = currentDocumentPathRef.current;
      const isNewDocument = !currentPath;

      const savedPath = await save({
        title: currentFormData.title,
        blocks: currentFormData.blocks,
        tags: currentFormData.tags,
        documentPath: currentPath,
        projectAlias: currentProject.alias,
      });

      if (isNewDocument && savedPath) {
        currentDocumentPathRef.current = savedPath;
        if (onNavigate) {
          onNavigate("document", { documentPath: savedPath });
        }
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [currentProject, save, error, onNavigate]);

  useEffect(() => {
    if (shouldAutoSave && currentProject && !isLoading) {
      onAutoSaveComplete();
      handleSave();
    }
  }, [
    shouldAutoSave,
    currentProject,
    isLoading,
    handleSave,
    onAutoSaveComplete,
  ]);

  const autoSave = useAutoSave({
    value: formData,
    onSave: handleSave,
    delay: 2000,
    enabled: hasChanges && !isLoading,
    saveOnBlur: true,
  });

  return {
    handleSave,
    autoSave,
  };
};
