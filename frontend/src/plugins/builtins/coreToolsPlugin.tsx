import { createExtension } from "@blocknote/core";
import { Extension } from "@tiptap/core";
import { Puzzle } from "lucide-react";
import { z } from "zod";
import type { PluginDefinition } from "../types";

const coreToolsConfigSchema = z.object({
	showSidebarSection: z.boolean().default(true),
});

export const coreToolsPlugin: PluginDefinition = {
	manifest: {
		id: "core.tools",
		name: "Core Tools",
		version: "1.0.0",
		apiVersion: "1",
		entry: "builtin:core-tools",
		capabilities: ["commands", "sidebar", "editorExtensions", "settings"],
		description: "Built-in plugin proving command/sidebar/editor extension points.",
	},
	setup: (api) => {
		api.registerConfig({
			schema: coreToolsConfigSchema,
			defaults: {
				showSidebarSection: true,
			},
		});

		api.registerCommands([
			{
				id: "plugin-core-tools-about",
				icon: <Puzzle className="text-lg" />,
				text: "Plugin System: Show Status",
				hint: "Core Tools",
				group: "Plugins",
				keywords: ["plugin", "extensions", "status"],
				action: () => {
					console.info("[plugin:core.tools] Plugin system is active");
				},
			},
		]);

		api.registerSidebarSections([
			{
				id: "plugin-core-tools",
				title: "PLUGINS",
				items: [
					{
						id: "plugin-core-tools-status",
						label: "plugin system active",
						onClick: () => {
							console.info("[plugin:core.tools] Sidebar action invoked");
						},
					},
				],
			},
		]);

		const markerExtension = Extension.create({
			name: "pluginCoreToolsMarker",
		});

		api.registerEditorExtensions([
			createExtension({
				key: "pluginCoreToolsMarker",
				tiptapExtensions: [markerExtension],
			}),
		]);
	},
};
