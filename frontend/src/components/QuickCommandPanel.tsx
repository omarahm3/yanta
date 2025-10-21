import React, { useMemo } from "react";
import { CommandPalette, CommandOption } from "./ui";
import { useProjectContext } from "../contexts/ProjectContext";

interface QuickCommandPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickCommandPanel: React.FC<QuickCommandPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const { projects, currentProject, setCurrentProject } = useProjectContext();

  const commandOptions: CommandOption[] = useMemo(() => {
    return projects
      .filter((project) => project.id !== currentProject?.id)
      .map((project) => ({
        id: project.id,
        icon: "→",
        text: `Switch to ${project.alias}`,
        hint: project.name,
        action: () => {
          setCurrentProject(project);
          onClose();
        },
      }));
  }, [projects, currentProject, setCurrentProject, onClose]);

  return (
    <CommandPalette
      isOpen={isOpen}
      onClose={onClose}
      onCommandSelect={() => {}}
      commands={commandOptions}
      placeholder="Switch project context..."
    />
  );
};
