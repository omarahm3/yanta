import React, { useState, useEffect, useCallback, useRef } from "react";
import { HelpCommand } from "../types";
import { StatusBar } from "../components";
import { Layout } from "../components/Layout";
import { DocumentList } from "../components/DocumentList";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useNotification } from "../hooks/useNotification";
import { useSidebarSections } from "../hooks/useSidebarSections";
import { useHotkeys, useHelp } from "../hooks";
import { useProjectContext, useDocumentContext } from "../contexts";
import { ParseWithContext } from "../../wailsjs/go/commandline/DocumentCommands";
import { SoftDelete, Restore } from "../../wailsjs/go/document/Service";
import { commandline } from "../../wailsjs/go/models";
import { preprocessCommand } from "../utils/commandPreprocessor";

const { DocumentCommand } = commandline;

const helpCommands: HelpCommand[] = [
  {
    command: `${DocumentCommand.New} [text]`,
    description: "Create a new document in the current project",
  },
  {
    command: `${DocumentCommand.Doc} <index>`,
    description: "Open a document by number (e.g., 'doc 3')",
  },
  {
    command: `${DocumentCommand.Archive} <index>`,
    description: "Archive a document by number (e.g., 'archive 2')",
  },
  {
    command: `${DocumentCommand.Unarchive} <index>`,
    description: "Unarchive a document by number",
  },
  {
    command: `${DocumentCommand.Delete} <index>`,
    description: "Soft delete a document (can be restored)",
  },
  {
    command: `${DocumentCommand.Delete} <index> --hard`,
    description:
      "PERMANENT deletion - removes from vault (⚠️ cannot be undone)",
  },
  {
    command: `${DocumentCommand.Delete} <index1>,<index2>,... --hard`,
    description: "Permanently delete multiple (e.g., 'delete 1,3,5 --hard')",
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
    selectedIndex: highlightedIndex,
    setSelectedIndex: setHighlightedIndex,
    selectNext: highlightNext,
    selectPrevious: highlightPrevious,
  } = useDocumentContext();

  const [commandInput, setCommandInput] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(
    new Set(),
  );
  const clearSelection = useCallback(() => {
    setSelectedDocuments(new Set());
  }, []);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
    inputPrompt?: string;
    expectedInput?: string;
    showCheckbox?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => { },
  });
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
    setShowArchived((prev) => !prev);
  }, []);

  const handleToggleSelection = useCallback(
    (path?: string) => {
      let targetDoc = null;
      if (path) {
        const docIndex = documents.findIndex((doc) => doc.path === path);
        if (docIndex !== -1) {
          targetDoc = documents[docIndex];
          setHighlightedIndex(docIndex);
        }
      } else if (highlightedIndex >= 0 && highlightedIndex < documents.length) {
        targetDoc = documents[highlightedIndex];
      }

      if (!targetDoc) return;

      const docPath = targetDoc.path;

      setSelectedDocuments((prev) => {
        const next = new Set(prev);
        if (next.has(docPath)) {
          next.delete(docPath);
        } else {
          next.add(docPath);
        }
        return next;
      });
    },
    [documents, highlightedIndex, setHighlightedIndex],
  );

  useEffect(() => {
    clearSelection();
  }, [currentProject, clearSelection]);

  const archivePaths = useCallback(
    async (paths: string[], successMessage: (count: number) => string) => {
      try {
        for (const path of paths) {
          await SoftDelete(path);
        }
        if (currentProject) {
          await loadDocuments(currentProject.alias, showArchived);
        }
        clearSelection();
        success(successMessage(paths.length));
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to archive");
      }
    },
    [
      clearSelection,
      currentProject,
      loadDocuments,
      showArchived,
      success,
      error,
    ],
  );

  const handleArchiveSelectedDocuments = useCallback(async () => {
    if (selectedDocuments.size === 0) {
      error("No documents selected. Press Space to select documents.");
      return;
    }
    const paths = Array.from(selectedDocuments);
    await archivePaths(paths, (count) =>
      count === 1 ? "Document archived" : `${count} documents archived`,
    );
  }, [selectedDocuments, archivePaths, error]);

  const handleRestoreSelectedDocuments = useCallback(async () => {
    if (!showArchived) {
      error("Enable archived view to restore documents (Ctrl+Shift+A).");
      return;
    }
    if (selectedDocuments.size === 0) {
      error("No documents selected. Press Space to select documents.");
      return;
    }
    const paths = Array.from(selectedDocuments);

    try {
      for (const path of paths) {
        await Restore(path);
      }
      if (currentProject) {
        await loadDocuments(currentProject.alias, showArchived);
      }
      clearSelection();
      success(
        paths.length === 1
          ? "Document restored"
          : `${paths.length} documents restored`,
      );
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to restore");
    }
  }, [
    clearSelection,
    currentProject,
    loadDocuments,
    showArchived,
    success,
    error,
    selectedDocuments,
  ]);

  const handleDeleteSelectedDocuments = useCallback(
    async (hard: boolean = false) => {
      if (selectedDocuments.size === 0) {
        error("No documents selected. Press Space to select documents.");
        return;
      }

      const selectedPaths = Array.from(selectedDocuments);
      if (selectedPaths.length === 1) {
        const doc = documents.find((d) => d.path === selectedPaths[0]);
        if (!doc) return;

        if (hard) {
          setConfirmDialog({
            isOpen: true,
            title: "Permanently Delete Document",
            message: `This will PERMANENTLY delete "${doc.title}" from the vault. This action CANNOT be undone!`,
            onConfirm: async () => {
              try {
                const result = await ParseWithContext(
                  `delete ${doc.path} --hard`,
                  currentProject?.alias || "",
                );
                if (!result.success) {
                  error(result.message || "Failed to delete");
                } else {
                  if (currentProject) {
                    loadDocuments(currentProject.alias, showArchived);
                  }
                  clearSelection();
                  success("Document permanently deleted");
                }
              } catch (err) {
                error(
                  err instanceof Error
                    ? err.message
                    : "Failed to permanently delete",
                );
              } finally {
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
              }
            },
            danger: true,
            showCheckbox: true,
          });
        } else {
          setConfirmDialog({
            isOpen: true,
            title: "Delete Document",
            message: `This will soft delete "${doc.title}". You can restore it later from archived view.`,
            onConfirm: async () => {
              try {
                await SoftDelete(doc.path);
                if (currentProject) {
                  loadDocuments(currentProject.alias, showArchived);
                }
                clearSelection();
                success("Document deleted");
              } catch (err) {
                error(err instanceof Error ? err.message : "Failed to delete");
              } finally {
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
              }
            },
            danger: false,
          });
        }
      } else {
        const count = selectedPaths.length;
        if (hard) {
          setConfirmDialog({
            isOpen: true,
            title: "Permanently Delete Multiple Documents",
            message: `This will PERMANENTLY delete ${count} document${count > 1 ? "s" : ""
              } from the vault. This action CANNOT be undone!`,
            onConfirm: async () => {
              try {
                const pathsString = selectedPaths.join(",");
                const result = await ParseWithContext(
                  `delete ${pathsString} --hard`,
                  currentProject?.alias || "",
                );
                if (!result.success) {
                  error(result.message || "Failed to delete");
                } else {
                  if (currentProject) {
                    loadDocuments(currentProject.alias, showArchived);
                  }
                  clearSelection();
                  success(`${count} documents permanently deleted`);
                }
              } catch (err) {
                error(
                  err instanceof Error
                    ? err.message
                    : "Failed to permanently delete",
                );
              } finally {
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
              }
            },
            danger: true,
            showCheckbox: true,
          });
        } else {
          setConfirmDialog({
            isOpen: true,
            title: "Delete Multiple Documents",
            message: `This will soft delete ${count} document${count > 1 ? "s" : ""
              }. You can restore them later from archived view.`,
            onConfirm: async () => {
              try {
                for (const path of selectedPaths) {
                  await SoftDelete(path);
                }
                if (currentProject) {
                  loadDocuments(currentProject.alias, showArchived);
                }
                clearSelection();
                success(`${count} documents deleted`);
              } catch (err) {
                error(err instanceof Error ? err.message : "Failed to delete");
              } finally {
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
              }
            },
            danger: false,
          });
        }
      }
    },
    [
      selectedDocuments,
      documents,
      currentProject,
      loadDocuments,
      showArchived,
      success,
      error,
      clearSelection,
    ],
  );

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
      onNavigate,
      error,
      success,
      currentProject,
      documents,
      loadDocuments,
      selectedDocuments,
    ],
  );

  const handleOpenHighlightedDocument = useCallback(() => {
    if (highlightedIndex < 0 || highlightedIndex >= documents.length) {
      return;
    }
    const doc = documents[highlightedIndex];
    if (doc) {
      handleDocumentClick(doc.path);
    }
  }, [highlightedIndex, documents, handleDocumentClick]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmDialog.isOpen) {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } else if (selectedDocuments.size > 0) {
          clearSelection();
        }
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [confirmDialog.isOpen, selectedDocuments.size, clearSelection]);

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
      key: "mod+D",
      handler: (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        handleDeleteSelectedDocuments(false);
      },
      allowInInput: false,
      description: "Soft delete selected documents",
    },
    {
      key: "mod+shift+D",
      handler: (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        handleDeleteSelectedDocuments(true);
      },
      allowInInput: false,
      description: "Permanently delete selected documents",
    },
    {
      key: "Space",
      handler: (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        handleToggleSelection();
      },
      allowInInput: false,
      description: "Select/deselect highlighted document",
    },
    {
      key: "Enter",
      handler: (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        handleOpenHighlightedDocument();
      },
      allowInInput: false,
      description: "Open highlighted document",
    },
    {
      key: "j",
      handler: (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        highlightNext();
      },
      allowInInput: false,
      description: "Highlight next document",
    },
    {
      key: "k",
      handler: (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        highlightPrevious();
      },
      allowInInput: false,
      description: "Highlight previous document",
    },
    {
      key: "ArrowDown",
      handler: (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        highlightNext();
      },
      allowInInput: false,
      description: "Navigate down",
    },
    {
      key: "ArrowUp",
      handler: (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        highlightPrevious();
      },
      allowInInput: false,
      description: "Navigate up",
    },
    {
      key: "mod+A",
      handler: (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        void handleArchiveSelectedDocuments();
      },
      allowInInput: false,
      description: "Archive selected documents",
    },
    {
      key: "mod+U",
      handler: (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        void handleRestoreSelectedDocuments();
      },
      allowInInput: false,
      description: "Restore selected documents",
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
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5">
              <DocumentList
                documents={documents}
                onDocumentClick={handleDocumentClick}
                highlightedIndex={highlightedIndex}
                onHighlightDocument={setHighlightedIndex}
                selectedDocuments={selectedDocuments}
                onToggleSelection={handleToggleSelection}
              />
            </div>
            <StatusBar
              totalEntries={documents.length}
              currentContext={currentProject?.alias ?? "UNKNOWN"}
              showArchived={showArchived}
              selectedCount={selectedDocuments.size}
              onClearSelection={
                selectedDocuments.size > 0 ? clearSelection : undefined
              }
            />
          </div>
        )}
      </Layout>
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() =>
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        }
        danger={confirmDialog.danger}
        inputPrompt={confirmDialog.inputPrompt}
        expectedInput={confirmDialog.expectedInput}
        showCheckbox={confirmDialog.showCheckbox}
      />
    </>
  );
};
