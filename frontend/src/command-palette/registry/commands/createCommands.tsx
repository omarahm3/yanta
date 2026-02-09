import { FilePlus } from "lucide-react";
import type { CommandOption } from "../../../components/ui";
import { getShortcutForCommand } from "../../../utils/shortcuts";
import { DocumentServiceWrapper } from "../../../services/DocumentService";
import type { CommandRegistry, CommandRegistryContext } from "../types";

export function registerCreateCommands(registry: CommandRegistry, ctx: CommandRegistryContext): void {
	const { onNavigate, handleClose, currentProject, notification } = ctx;
	const commands: CommandOption[] = [];

	if (currentProject) {
		commands.push({
			id: "new-document",
			icon: <FilePlus className="text-lg" />,
			text: "New Document",
			hint: "Create new entry",
			shortcut: getShortcutForCommand("new-document"),
			group: "Create",
			keywords: ["create", "add", "note"],
			action: async () => {
				handleClose();
				if (!currentProject) return;
				try {
					const newPath = await DocumentServiceWrapper.save({
						projectAlias: currentProject.alias,
						title: "Untitled",
						blocks: [
							{
								id: "initial-heading",
								type: "heading",
								props: { level: 1 },
								content: [{ type: "text", text: "", styles: {} }],
							},
						],
						tags: [],
					});
					onNavigate("document", { documentPath: newPath, newDocument: true });
				} catch (err) {
					notification.error(`Failed to create document: ${err}`);
				}
			},
		});
	}

	registry.setCommands("create", commands);
}
