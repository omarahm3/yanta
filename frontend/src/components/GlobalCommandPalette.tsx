import React, { useMemo } from "react";
import { CommandPalette, CommandOption } from "./ui";
import { useProjectContext } from "../contexts/ProjectContext";
import {
  RiDashboardLine,
  RiFolderLine,
  RiSearchLine,
  RiSettings3Line,
  RiFileAddLine,
  RiArrowRightLine,
  RiArchiveLine,
  RiInboxUnarchiveLine,
} from "react-icons/ri";

interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (
    page: string,
    state?: Record<string, string | number | boolean | undefined>,
  ) => void;
  currentPage?: string;
  onToggleArchived?: () => void;
  showArchived?: boolean;
}

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  currentPage,
  onToggleArchived,
  showArchived,
}) => {
  const { projects, currentProject, setCurrentProject } = useProjectContext();

  const commandOptions: CommandOption[] = useMemo(() => {
    const commands: CommandOption[] = [];

    commands.push({
      id: "nav-dashboard",
      icon: <RiDashboardLine className="text-lg" />,
      text: "Go to Dashboard",
      hint: "Home",
      action: () => {
        onNavigate("dashboard");
        onClose();
      },
    });

    commands.push({
      id: "nav-projects",
      icon: <RiFolderLine className="text-lg" />,
      text: "Go to Projects",
      hint: "Manage projects",
      action: () => {
        onNavigate("projects");
        onClose();
      },
    });

    commands.push({
      id: "nav-search",
      icon: <RiSearchLine className="text-lg" />,
      text: "Go to Search",
      hint: "Find documents",
      action: () => {
        onNavigate("search");
        onClose();
      },
    });

    commands.push({
      id: "nav-settings",
      icon: <RiSettings3Line className="text-lg" />,
      text: "Go to Settings",
      hint: "Configure app",
      action: () => {
        onNavigate("settings");
        onClose();
      },
    });

    commands.push({
      id: "new-document",
      icon: <RiFileAddLine className="text-lg" />,
      text: "New Document",
      hint: "Create new entry",
      action: () => {
        onNavigate("document");
        onClose();
      },
    });

    if (currentPage === "dashboard" && onToggleArchived && currentProject) {
      commands.push({
        id: "toggle-archived",
        icon: showArchived ? (
          <RiInboxUnarchiveLine className="text-lg" />
        ) : (
          <RiArchiveLine className="text-lg" />
        ),
        text: showArchived
          ? "Hide Archived Documents"
          : "Show Archived Documents",
        hint: `${currentProject.alias} context`,
        action: () => {
          onToggleArchived();
          onClose();
        },
      });
    }

    projects
      .filter((project) => project.id !== currentProject?.id)
      .forEach((project) => {
        commands.push({
          id: `project-${project.id}`,
          icon: <RiArrowRightLine className="text-lg" />,
          text: `Switch to ${project.alias}`,
          hint: project.name,
          action: () => {
            setCurrentProject(project);
            onClose();
          },
        });
      });

    return commands;
  }, [
    projects,
    currentProject,
    setCurrentProject,
    onNavigate,
    onClose,
    currentPage,
    onToggleArchived,
    showArchived,
  ]);

  return (
    <CommandPalette
      isOpen={isOpen}
      onClose={onClose}
      onCommandSelect={() => {}}
      commands={commandOptions}
      placeholder="Type a command or search..."
    />
  );
};
