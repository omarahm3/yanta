import { useEffect, useRef, useState } from "react";
import { useDocumentLoader } from "./useDocumentLoader";
import { createEmptyDocument } from "../utils/documentBlockUtils";
import { BlockNoteBlock } from "../types/Document";

interface DocumentFormData {
  title: string;
  blocks: BlockNoteBlock[];
  tags: string[];
}

interface UseDocumentInitializationProps {
  documentPath?: string;
  initialTitle?: string;
  initializeForm: (data: DocumentFormData) => void;
}

export const useDocumentInitialization = ({
  documentPath,
  initialTitle,
  initializeForm,
}: UseDocumentInitializationProps) => {
  const { data, isLoading, error: loadError } = useDocumentLoader(documentPath);

  const [shouldAutoSave, setShouldAutoSave] = useState(false);
  const initializedForPathRef = useRef<string | null>(null);

  useEffect(() => {
    const isEditMode = !!documentPath;

    if (isEditMode) {
      if (
        data &&
        !isLoading &&
        initializedForPathRef.current !== documentPath
      ) {
        initializeForm({
          title: data.title,
          blocks: data.blocks,
          tags: data.tags,
        });
        initializedForPathRef.current = documentPath;
      }
    } else {
      if (initialTitle && initializedForPathRef.current !== initialTitle) {
        const formData = createEmptyDocument(initialTitle);
        initializeForm(formData);
        initializedForPathRef.current = initialTitle;
        setShouldAutoSave(true);
      }
    }
  }, [data, isLoading, documentPath, initialTitle, initializeForm]);

  const resetAutoSave = () => {
    setShouldAutoSave(false);
  };

  return {
    data,
    isLoading,
    loadError,
    shouldAutoSave,
    resetAutoSave,
  };
};
