import type React from "react";
import { useMemo } from "react";
import { useProjectContext } from "../contexts/ProjectContext";
import { type CommandOption, CommandPalette } from "./ui";

interface QuickCommandPanelProps {
	isOpen: boolean;
	onClose: () => void;
}

export const QuickCommandPanel: React.FC<QuickCommandPanelProps> = ({ isOpen, onClose }) => {
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
