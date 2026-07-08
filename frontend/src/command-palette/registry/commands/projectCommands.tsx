import {
	Archive,
	ArchiveRestore,
	ArrowLeftRight,
	ArrowRight,
	FileDown,
	FolderPlus,
	Pencil,
} from "lucide-react";
import { ExportProjectRequest } from "../../../../bindings/yanta/internal/document/models";
import { ExportProject } from "../../../../bindings/yanta/internal/document/service";
import { OpenDirectoryDialog } from "../../../../bindings/yanta/internal/system/service";
import { useProjectManageStore } from "../../../project/projectManage.store";
import type { CommandOption } from "../../../shared/ui";
import { getShortcutForCommand } from "../../../shared/utils/shortcuts";
import type { CommandRegistry, CommandRegistryContext } from "../types";

export function registerProjectCommands(
	registry: CommandRegistry,
	ctx: CommandRegistryContext,
): void {
	const {
		handleClose,
		currentProject,
		previousProject,
		projects,
		setCurrentProject,
		switchToLastProject,
		currentPage,
		onNavigate,
		onToggleArchived,
		showArchived,
		notification,
	} = ctx;
	const commands: CommandOption[] = [];

	commands.push({
		id: "new-project",
		icon: <FolderPlus className="text-lg" />,
		text: "New Project",
		hint: "Create a project",
		group: "Projects",
		keywords: ["create", "add", "project"],
		action: () => {
			useProjectManageStore.getState().requestNew();
			onNavigate("projects");
			handleClose();
		},
	});

	if (currentProject) {
		commands.push({
			id: "rename-project",
			icon: <Pencil className="text-lg" />,
			text: `Rename ${currentProject.alias}`,
			hint: currentProject.name,
			group: "Projects",
			keywords: ["rename", "project"],
			action: () => {
				useProjectManageStore.getState().requestRename(currentProject.id);
				onNavigate("projects");
				handleClose();
			},
		});
	}

	if (currentProject) {
		commands.push({
			id: "export-project",
			icon: <FileDown className="text-lg" />,
			text: "Export Project",
			hint: "Export project to markdown",
			group: "Projects",
			action: async () => {
				handleClose();
				try {
					const outputDir = await OpenDirectoryDialog();
					if (!outputDir) return;
					await ExportProject(
						new ExportProjectRequest({
							ProjectAlias: currentProject.alias,
							OutputDir: outputDir,
						}),
					);
				} catch (err) {
					notification.error(`Export failed: ${err}`);
				}
			},
		});
	}

	if (previousProject) {
		commands.push({
			id: "switch-last",
			icon: <ArrowLeftRight className="text-lg" />,
			text: `Switch to @${previousProject.alias}`,
			hint: previousProject.name,
			shortcut: getShortcutForCommand("switch-last"),
			group: "Projects",
			keywords: ["quick", "switch", "toggle", "last"],
			action: () => {
				switchToLastProject();
				handleClose();
			},
		});
	}

	if (currentPage === "dashboard" && onToggleArchived && currentProject) {
		commands.push({
			id: "toggle-archived",
			icon: showArchived ? <ArchiveRestore className="text-lg" /> : <Archive className="text-lg" />,
			text: showArchived ? "Hide Archived Documents" : "Show Archived Documents",
			hint: `${currentProject.alias} context`,
			group: "Projects",
			action: () => {
				onToggleArchived();
				handleClose();
			},
		});
	}

	projects
		.filter((project) => project.id !== currentProject?.id)
		.forEach((project) => {
			commands.push({
				id: `project-${project.id}`,
				icon: <ArrowRight className="text-lg" />,
				text: `Switch to ${project.alias}`,
				hint: project.name,
				group: "Projects",
				action: () => {
					setCurrentProject(project);
					handleClose();
				},
			});
		});

	registry.setCommands("projects", commands);
}
