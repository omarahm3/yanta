import React from "react";
import {
  DocumentLoadingState,
  DocumentErrorState,
  DocumentContent,
} from "../components/document";
import { useHotkeys } from "../hooks";
import { useDocumentController } from "./document/useDocumentController";

export interface DocumentProps {
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
  const controller = useDocumentController({
    onNavigate,
    documentPath,
    initialTitle,
  });

  useHotkeys(controller.hotkeys);

  if (controller.isLoading) {
    return <DocumentLoadingState sidebarSections={controller.sidebarSections} />;
  }

  if (controller.showError) {
    return (
      <DocumentErrorState
        sidebarSections={controller.sidebarSections}
        onNavigate={onNavigate}
      />
    );
  }

  return <DocumentContent {...controller.contentProps} />;
};
