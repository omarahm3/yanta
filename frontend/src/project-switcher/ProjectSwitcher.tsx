import { Check } from "lucide-react";
import type React from "react";
import { useCallback } from "react";
import { useProjectContext } from "../project";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "../shared/ui/command";
import { Kbd } from "../shared/ui/Kbd";
import { useProjectSwitcherStore } from "./projectSwitcher.store";

const FOOTER_HINTS = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "↵", label: "Switch" },
];

/**
 * Keyboard-first project switcher: a focused overlay listing every active
 * project with fuzzy search. Open it (⌘⇧K, or click the project in the status
 * bar), type to filter, Enter to switch. Switching is just setCurrentProject —
 * the rest of the app reacts to the store.
 */
export const ProjectSwitcher: React.FC = () => {
	const isOpen = useProjectSwitcherStore((s) => s.isOpen);
	const close = useProjectSwitcherStore((s) => s.close);
	const { projects, currentProject, setCurrentProject } = useProjectContext();

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) close();
		},
		[close],
	);

	const handleSelect = useCallback(
		(id: string) => {
			const project = projects.find((p) => p.id === id);
			if (project && project.id !== currentProject?.id) {
				setCurrentProject(project);
			}
			close();
		},
		[projects, currentProject?.id, setCurrentProject, close],
	);

	return (
		<CommandDialog
			open={isOpen}
			onOpenChange={handleOpenChange}
			title="Switch project"
			description="Search your projects and switch the active one."
		>
			<CommandInput placeholder="Switch to project…" />
			<CommandList>
				<CommandEmpty>
					<div className="flex flex-col items-center gap-1">
						<span>No projects found</span>
						<span className="text-xs text-text-dim">Try a different name</span>
					</div>
				</CommandEmpty>
				<CommandGroup heading="Projects">
					{projects.map((project) => {
						const isCurrent = project.id === currentProject?.id;
						return (
							<CommandItem
								key={project.id}
								value={`${project.alias} ${project.name}`}
								keywords={[project.name, project.alias]}
								onSelect={() => handleSelect(project.id)}
							>
								<span className="font-mono text-accent">@{project.alias}</span>
								<span className="flex-1 truncate text-text">{project.name}</span>
								{isCurrent && (
									<span className="ml-auto inline-flex items-center gap-1 text-[11px] text-text-dim">
										<Check className="size-3.5 text-accent" aria-hidden="true" />
										current
									</span>
								)}
							</CommandItem>
						);
					})}
				</CommandGroup>
			</CommandList>
			<div className="flex items-center gap-4 border-t border-border px-4 py-2">
				{FOOTER_HINTS.map((hint) => (
					<span key={hint.key} className="flex items-center gap-1.5 text-[11px] text-text-dim">
						<Kbd className="text-[10px]">{hint.key}</Kbd>
						<span>{hint.label}</span>
					</span>
				))}
			</div>
		</CommandDialog>
	);
};
