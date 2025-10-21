import React from "react";
import { Layout } from "../Layout";
import { SidebarSection } from "../ui";
import { DocumentEditorForm } from "./DocumentEditorForm";
import { DocumentEditorActions } from "./DocumentEditorActions";
import { BlockNoteBlock } from "../../types/Document";
import { BlockNoteEditor } from "@blocknote/core";
import { SaveState } from "../../hooks/useAutoSave";
import { Project } from "../../types/Project";

interface DocumentContentProps {
  sidebarSections: SidebarSection[];
  currentProject: Project | undefined;
  formData: {
    blocks: BlockNoteBlock[];
    tags: string[];
  };
  isEditMode: boolean;
  isLoading: boolean;
  autoSave: {
    saveState: SaveState;
    lastSaved: Date | null;
    hasUnsavedChanges: boolean;
    saveError: Error | null;
    saveNow: () => Promise<void>;
  };
  commandInput: string;
  onCommandChange: (value: string) => void;
  onCommandSubmit: (command: string) => void;
  onTitleChange: (title: string) => void;
  onBlocksChange: (blocks: BlockNoteBlock[]) => void;
  onTagRemove: (tag: string) => void;
  onEditorReady: (editor: BlockNoteEditor) => void;
  onCancel: () => void;
}

export const DocumentContent: React.FC<DocumentContentProps> = React.memo(
  ({
    sidebarSections,
    currentProject,
    formData,
    isEditMode,
    isLoading,
    autoSave,
    commandInput,
    onCommandChange,
    onCommandSubmit,
    onTitleChange,
    onBlocksChange,
    onTagRemove,
    onEditorReady,
    onCancel,
  }) => (
    <Layout
      sidebarSections={sidebarSections}
      currentPage={currentProject?.alias ?? "document"}
      showCommandLine={true}
      commandContext="document"
      commandPlaceholder=":tag web frontend | :untag react | :tags"
      commandValue={commandInput}
      onCommandChange={onCommandChange}
      onCommandSubmit={onCommandSubmit}
    >
      <div className="flex flex-col w-full h-full">
        <DocumentEditorForm
          blocks={formData.blocks}
          tags={formData.tags}
          isEditMode={isEditMode}
          isLoading={isLoading}
          onTitleChange={onTitleChange}
          onBlocksChange={onBlocksChange}
          onTagRemove={onTagRemove}
          onEditorReady={onEditorReady}
        />

        <DocumentEditorActions
          isEditMode={isEditMode}
          saveState={autoSave.saveState}
          lastSaved={autoSave.lastSaved}
          hasUnsavedChanges={autoSave.hasUnsavedChanges}
          saveError={autoSave.saveError}
          onCancel={onCancel}
          onSaveNow={autoSave.saveNow}
        />
      </div>
    </Layout>
  ),
);

DocumentContent.displayName = "DocumentContent";
