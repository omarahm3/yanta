# Plugin Example (Reference Only)

This example shows how a frontend plugin can contribute commands, sidebar sections, and editor extensions.

It is documentation-only and is not loaded by the production app runtime.

```tsx
import { createExtension } from "@blocknote/core";
import { Extension } from "@tiptap/core";
import { Puzzle } from "lucide-react";
import { z } from "zod";
import type { PluginDefinition } from "../frontend/src/plugins/types";

const configSchema = z.object({
	showSidebarSection: z.boolean().default(true),
});

export const examplePlugin: PluginDefinition = {
	manifest: {
		id: "example.tools",
		name: "Example Tools",
		version: "1.0.0",
		apiVersion: "1",
		entry: "example:tools",
		capabilities: ["commands", "sidebar", "editorExtensions", "settings"],
	},
	setup: (api) => {
		api.registerConfig({
			schema: configSchema,
			defaults: { showSidebarSection: true },
		});

		api.registerCommands([
			{
				id: "example-tools-about",
				icon: <Puzzle className="text-lg" />,
				text: "Example Plugin: Show Status",
				hint: "Example Tools",
				group: "Plugins",
				keywords: ["plugin", "example"],
				action: () => {
					console.info("[plugin:example.tools] active");
				},
			},
		]);

		api.registerSidebarSections([
			{
				id: "example-tools",
				title: "PLUGINS",
				items: [{ id: "example-tools-item", label: "example plugin active" }],
			},
		]);

		const markerExtension = Extension.create({
			name: "examplePluginMarker",
		});

		api.registerEditorExtensions([
			createExtension({
				key: "examplePluginMarker",
				tiptapExtensions: [markerExtension],
			}),
		]);
	},
};
```

