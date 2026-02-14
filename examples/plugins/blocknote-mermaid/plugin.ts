import { MermaidBlock, insertMermaid } from "@defensestation/blocknote-mermaid";

type YantaPluginAPI = {
	registerEditorBlockSpecs: (blockSpecs: Record<string, unknown>) => void;
	registerEditorSlashMenuItems: (
		items: Array<{
			title: string;
			subtext?: string;
			aliases?: string[];
			group?: string;
			onItemClick: (ctx: { editor: any }) => void | Promise<void>;
		}>,
	) => void;
};

export function setup(api: YantaPluginAPI): void {
	api.registerEditorBlockSpecs({
		mermaid: MermaidBlock,
	});

	const mermaidSlashItem = insertMermaid();
	const { onItemClick, ...rest } = mermaidSlashItem;

	api.registerEditorSlashMenuItems([
		{
			...(rest as Record<string, unknown>),
			onItemClick: (ctx) => {
				onItemClick?.(ctx.editor);
			},
		},
	]);
}

export default { setup };
