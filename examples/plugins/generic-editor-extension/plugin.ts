import { createExtension } from "@blocknote/core";
import { Extension } from "@tiptap/core";

type YantaPluginAPI = {
	registerCommands: (commands: Array<{ id: string; text: string; group: string; action: () => void }>) => void;
	registerEditorExtensions: (extensions: unknown[]) => void;
	registerEditorTipTapExtensions: (extensions: unknown[]) => void;
	registerEditorBlockSpecs: (blockSpecs: Record<string, unknown>) => void;
	registerEditorStyleSpecs: (styleSpecs: Record<string, unknown>) => void;
	registerEditorSlashMenuItems: (
		items: Array<{
			title: string;
			subtext?: string;
			aliases?: string[];
			group?: string;
			onItemClick: (ctx: { editor: any }) => void;
		}>,
	) => void;
	registerEditorLifecycleHooks: (hooks: {
		onEditorReady?: (ctx: { editor: any; editable: boolean }) => void;
		onEditorDestroy?: (ctx: { editor: any; editable: boolean }) => void;
	}) => void;
};

const ExampleTipTapExtension = Extension.create({
	name: "exampleTipTapExtension",
});

export function setup(api: YantaPluginAPI): void {
	api.registerCommands([
		{
			id: "example-generic-plugin",
			text: "Plugin: Generic Editor Extension",
			group: "Plugins",
			action: () => {
				console.info("[plugin:generic-editor-extension] command executed");
			},
		},
	]);

	api.registerEditorExtensions([
		createExtension({
			key: "example.generic.editor.marker",
		}),
	]);

	api.registerEditorTipTapExtensions([ExampleTipTapExtension]);
	api.registerEditorBlockSpecs({});
	api.registerEditorStyleSpecs({});

	api.registerEditorSlashMenuItems([
		{
			title: "Insert Example Marker",
			subtext: "Adds an empty paragraph below current cursor.",
			aliases: ["example", "marker"],
			group: "Plugins",
			onItemClick: ({ editor }) => {
				const cursor = editor.getTextCursorPosition();
				editor.insertBlocks([{ type: "paragraph", content: "Example plugin block." }], cursor.block, "after");
			},
		},
	]);

	api.registerEditorLifecycleHooks({
		onEditorReady: ({ editor }) => {
			console.info("[plugin:generic-editor-extension] ready", editor);
		},
		onEditorDestroy: ({ editor }) => {
			console.info("[plugin:generic-editor-extension] destroy", editor);
		},
	});
}

export default { setup };
