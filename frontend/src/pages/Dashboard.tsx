import React, { useState, useEffect, useCallback, useRef } from "react";
import { HelpCommand } from "../types";
import { StatusBar } from "../components";
import { Layout } from "../components/Layout";
import { DocumentList } from "../components/DocumentList";
import { useNotification } from "../hooks/useNotification";
import { useSidebarSections } from "../hooks/useSidebarSections";
import { useHotkeys, useHelp } from "../hooks";
import { useProjectContext, useDocumentContext } from "../contexts";
import { ParseWithContext } from "../../wailsjs/go/commandline/DocumentCommands";
import { commandline } from "../../wailsjs/go/models";
import { preprocessCommand } from "../utils/commandPreprocessor";

const { DocumentCommand } = commandline;

const helpCommands: HelpCommand[] = [
  {
    command: `${DocumentCommand.New} [text]`,
    description: "Create a new document in the current project",
  },
  {
    command: `${DocumentCommand.Doc} <path>`,
    description: "Open a document by path",
  },
  {
    command: `${DocumentCommand.Archive} <path>`,
    description: "Archive a document",
  },
  {
    command: `${DocumentCommand.Unarchive} <path>`,
    description: "Unarchive a document",
  },
  {
    command: `${DocumentCommand.Delete} <path>`,
    description: "Delete a document",
  },
];

interface DashboardProps {
  onNavigate?: (
    page: string,
    state?: Record<string, string | number | boolean | undefined>,
  ) => void;
  onRegisterToggleArchived?: (handler: () => void) => void;
  getShowArchived?: () => boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onRegisterToggleArchived,
}) => {
  const { currentProject, isLoading: projectsLoading } = useProjectContext();

  const {
    documents,
    loadDocuments,
    isLoading: documentsLoading,
    selectedIndex,
    setSelectedIndex,
    selectNext,
    selectPrevious,
  } = useDocumentContext();

  const [commandInput, setCommandInput] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const { success, error } = useNotification();
  const { setPageContext } = useHelp();
  const commandInputRef = useRef<HTMLInputElement>(null);
  const currentProjectRef = useRef(currentProject);

  useEffect(() => {
    currentProjectRef.current = currentProject;
  }, [currentProject]);

  useEffect(() => {
    setPageContext(helpCommands, "Dashboard");
  }, [setPageContext]);

  useEffect(() => {
    if (currentProject) {
      loadDocuments(currentProject.alias, showArchived);
    }
  }, [currentProject, loadDocuments, showArchived]);

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const handleDocumentClick = useCallback(
    (path: string) => {
      onNavigate?.("document", { documentPath: path });
    },
    [onNavigate],
  );

  const handleNewDocument = useCallback(() => {
    if (!currentProjectRef.current) {
      error("No project selected");
      return;
    }
    onNavigate?.("document");
  }, [onNavigate, error]);

  const handleToggleArchived = useCallback(() => {
    setShowArchived((prev) => {
      const newValue = !prev;
      setTimeout(() => {
        success(
          newValue ? "Showing archived documents" : "Hiding archived documents",
        );
      }, 0);
      return newValue;
    });
  }, [success]);

  useEffect(() => {
    if (onRegisterToggleArchived) {
      onRegisterToggleArchived(handleToggleArchived);
    }
  }, [onRegisterToggleArchived, handleToggleArchived]);

  const handleCommandSubmit = useCallback(
    async (command: string) => {
      if (!currentProject) {
        error("No project selected");
        return;
      }

      try {
        const preprocessedCommand = preprocessCommand(command, documents);
        console.log("> preprocessed command:", preprocessedCommand);
        const result = await ParseWithContext(
          preprocessedCommand,
          currentProject.alias,
        );
        console.log("< command result:", result);

        if (!result.success) {
          if (result.message) error(result.message);
          return;
        }

        const actions: Record<string, () => void> = {
          "navigate to new document": () => {
            return onNavigate?.("document", {
              initialTitle: result.data?.title,
            });
          },
          "navigate to document": () =>
            onNavigate?.("document", {
              documentPath: result.data?.documentPath,
            }),
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
    [onNavigate, error, success, currentProject, documents, loadDocuments],
  );

  useHotkeys([
    {
      key: "mod+N",
      handler: handleNewDocument,
      allowInInput: false,
      description: "Create new document",
    },
    {
      key: "mod+shift+A",
      handler: handleToggleArchived,
      allowInInput: false,
      description: "Toggle archived documents view",
    },
    {
      key: "j",
      handler: selectNext,
      allowInInput: false,
      description: "Select next document",
    },
    {
      key: "k",
      handler: selectPrevious,
      allowInInput: false,
      description: "Select previous document",
    },
    {
      key: "ArrowDown",
      handler: selectNext,
      allowInInput: false,
      description: "Select next document",
    },
    {
      key: "ArrowUp",
      handler: selectPrevious,
      allowInInput: false,
      description: "Select previous document",
    },
    {
      key: "Enter",
      handler: () => {
        if (selectedIndex >= 0 && selectedIndex < documents.length) {
          handleDocumentClick(documents[selectedIndex].path);
        }
      },
      allowInInput: false,
      description: "Open selected document",
    },
    {
      key: "mod+A",
      handler: () => {
        if (!currentProjectRef.current) {
          error("No project selected");
          return;
        }
        setCommandInput(`${DocumentCommand.Archive} `);
        setTimeout(() => {
          commandInputRef.current?.focus();
          const len = `${DocumentCommand.Archive} `.length;
          commandInputRef.current?.setSelectionRange(len, len);
        }, 0);
      },
      allowInInput: false,
      description: "Archive document",
    },
    {
      key: "mod+U",
      handler: () => {
        if (!currentProjectRef.current) {
          error("No project selected");
          return;
        }
        setCommandInput(`${DocumentCommand.Unarchive} `);
        setTimeout(() => {
          commandInputRef.current?.focus();
          const len = `${DocumentCommand.Unarchive} `.length;
          commandInputRef.current?.setSelectionRange(len, len);
        }, 0);
      },
      allowInInput: false,
      description: "Unarchive document",
    },
  ]);

  const sidebarSections = useSidebarSections({
    currentPage: "dashboard",
    onNavigate,
  });

  return (
    <>
      <Layout
        sidebarSections={sidebarSections}
        currentPage="dashboard"
        showCommandLine={true}
        commandContext={currentProject?.alias}
        commandPlaceholder="what did you ship today?"
        commandValue={commandInput}
        onCommandChange={setCommandInput}
        onCommandSubmit={handleCommandSubmit}
        commandInputRef={commandInputRef}
      >
        {projectsLoading || documentsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-text-dim">Loading...</div>
          </div>
        ) : (
          <>
            <div className="p-5">
              <DocumentList
                documents={documents}
                onDocumentClick={handleDocumentClick}
                selectedIndex={selectedIndex}
                onSelectDocument={setSelectedIndex}
              />
            </div>
            <StatusBar
              totalEntries={documents.length}
              currentContext={currentProject?.alias ?? "UNKNOWN"}
              showArchived={showArchived}
            />
          </>
        )}
      </Layout>
    </>
  );
};
