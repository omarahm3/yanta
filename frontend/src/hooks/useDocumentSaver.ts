import { useState, useCallback } from 'react';
import { BlockNoteBlock } from '../types/Document';
import { DocumentServiceWrapper } from '../services/DocumentService';

interface SaveDocumentParams {
  title: string;
  blocks: BlockNoteBlock[];
  tags: string[];
  documentPath?: string;
  projectAlias: string;
}

export const useDocumentSaver = (
  onSuccess: (message: string) => void,
  onError: (message: string) => void
) => {
  const [isSaving, setIsSaving] = useState(false);

  const save = useCallback(async (params: SaveDocumentParams) => {
    setIsSaving(true);
    try {
      const savedPath = await DocumentServiceWrapper.save({
        path: params.documentPath || '',
        projectAlias: params.projectAlias,
        title: params.title || 'Untitled',
        blocks: params.blocks,
        tags: params.tags,
      });

      const message = params.documentPath
        ? 'Document updated successfully'
        : `Document created: ${savedPath}`;

      onSuccess(message);
      return savedPath;
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'Failed to save document';
      onError(errorMessage);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [onSuccess, onError]);

  return {
    save,
    isSaving,
  };
};
