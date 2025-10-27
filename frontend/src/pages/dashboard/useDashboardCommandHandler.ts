import { RefObject, useCallback } from "react";
import { ParseWithContext } from "../../../wailsjs/go/commandline/DocumentCommands";
import { Document } from "../../types/Document";
import { Project } from "../../types/Project";
import { preprocessCommand } from "../../utils/commandPreprocessor";

interface DashboardCommandHandlerOptions {
  documents: Document[];
  selectedDocuments: Set<string>;
  currentProject: Project | null | undefined;
  loadDocuments: (
    projectAlias: string,
    includeArchived?: boolean,
  ) => Promise<void>;
  onNavigate?: (
    page: string,
    state?: Record<string, string | number | boolean | undefined>,
  ) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  setCommandInput: (value: string) => void;
  commandInputRef: RefObject<HTMLInputElement>;
  onConfirmationRequired?: (data: {
    title: string;
    message: string;
    confirmationCommand: string;
    danger?: boolean;
    inputPrompt?: string;
    expectedInput?: string;
    showCheckbox?: boolean;
  }) => void;
}

export const useDashboardCommandHandler = ({
  documents,
  selectedDocuments,
  currentProject,
  loadDocuments,
  onNavigate,
  success,
  error,
  setCommandInput,
  commandInputRef,
  onConfirmationRequired,
}: DashboardCommandHandlerOptions) => {
  const handleCommandSubmit = useCallback(
    async (command: string) => {
      if (!currentProject) {
        error("No project selected");
        return;
      }

      try {
        const commandTrimmed = command.trim();
        const withoutPrefix = commandTrimmed.startsWith(":")
          ? commandTrimmed.slice(1).trimStart()
          : commandTrimmed;
        if (!withoutPrefix) {
          error("Empty command");
          return;
        }

        const selectedPathsInOrder = documents
          .filter((doc) => selectedDocuments.has(doc.path))
          .map((doc) => doc.path);

        const preprocessedCommand = preprocessCommand(
          withoutPrefix,
          documents,
          selectedPathsInOrder,
        );
        const result = await ParseWithContext(
          preprocessedCommand,
          currentProject.alias,
        );

        if (!result.success) {
          if (result.message) error(result.message);
          return;
        }

        if (
          result.data?.requiresConfirmation &&
          result.data.confirmationCommand &&
          onConfirmationRequired
        ) {
          const isHard = result.data.flags?.includes("--hard") ?? false;
          const isArchive = withoutPrefix.startsWith("archive ");
          const isDelete = withoutPrefix.startsWith("delete ");

          let title = "Confirm Action";
          let message = result.message || "Confirm this action?";
          let danger = false;
          let inputPrompt: string | undefined = undefined;
          let expectedInput: string | undefined = undefined;
          let showCheckbox = false;

          if (isArchive) {
            title = "Archive Document";
            message = result.message;
            danger = false;
          } else if (isDelete) {
            if (isHard) {
              title = "Permanently Delete Document";
              message =
                result.message ||
                "This will PERMANENTLY delete the document. This action CANNOT be undone!";
              showCheckbox = true;
              danger = true;
            } else {
              title = "Delete Document";
              message = result.message;
              danger = false;
            }
          }

          commandInputRef.current?.blur();
          onConfirmationRequired({
            title,
            message,
            confirmationCommand: result.data.confirmationCommand,
            danger,
            inputPrompt,
            expectedInput,
            showCheckbox,
          });
          return;
        }

        const actions: Record<string, () => void> = {
          "navigate to new document": () => {
            onNavigate?.("document", {
              initialTitle: result.data?.title,
            });
          },
          "navigate to document": () => {
            onNavigate?.("document", {
              documentPath: result.data?.documentPath,
            });
          },
          "document archived": () => {
            loadDocuments(currentProject.alias);
            success("Document archived");
          },
          "document unarchived": () => {
            loadDocuments(currentProject.alias);
            success("Document unarchived");
          },
          "document deleted": () => {
            loadDocuments(currentProject.alias);
            success("Document deleted");
          },
          "document permanently deleted": () => {
            loadDocuments(currentProject.alias);
            success("Document permanently deleted");
          },
        };

        const action = actions[result.message];
        if (action) {
          action();
        } else if (result.message) {
          if (result.message.includes("permanently deleted")) {
            loadDocuments(currentProject.alias);
          }
          success(result.message);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Command failed");
      } finally {
        setCommandInput("");
        commandInputRef.current?.blur();
      }
    },
    [
      currentProject,
      documents,
      selectedDocuments,
      error,
      onNavigate,
      loadDocuments,
      success,
      setCommandInput,
      commandInputRef,
    ],
  );

  return { handleCommandSubmit };
};
