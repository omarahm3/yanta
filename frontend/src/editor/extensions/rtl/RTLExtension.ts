import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { detectTextDirection, resolveBlockDir } from "./textDirection";

export interface RTLExtensionOptions {
	autoDetect: boolean;
}

interface DocRange {
	from: number;
	to: number;
}

/**
 * The document ranges touched by a batch of transactions, expressed in the FINAL
 * (newState) coordinates. Each step's changed slice is mapped forward through
 * every later step — the rest of its own transaction, then every subsequent
 * transaction — so the scan can run against `newState.doc`. This is what turns
 * the per-keystroke O(document) scan into O(edit): only touched blocks are
 * re-checked instead of the whole document.
 */
export function collectChangedRanges(transactions: readonly Transaction[]): DocRange[] {
	const ranges: DocRange[] = [];
	transactions.forEach((tr, txIndex) => {
		if (!tr.docChanged) return;
		const maps = tr.mapping.maps;
		maps.forEach((stepMap, mapIndex) => {
			stepMap.forEach((_oldFrom, _oldTo, newFrom, newTo) => {
				let from = newFrom;
				let to = newTo;
				for (let i = mapIndex + 1; i < maps.length; i += 1) {
					from = maps[i].map(from, -1);
					to = maps[i].map(to, 1);
				}
				for (let t = txIndex + 1; t < transactions.length; t += 1) {
					from = transactions[t].mapping.map(from, -1);
					to = transactions[t].mapping.map(to, 1);
				}
				ranges.push({ from, to });
			});
		});
	});
	return ranges;
}

/**
 * The RTL auto-direction plugin. Exported so it can be exercised against a plain
 * ProseMirror `EditorState` in tests. Re-detecting a block's direction always
 * reads that block's own current text, so visiting an extra block is harmless —
 * only the touched blocks are visited, and each is set from its real content.
 */
export function createRTLPlugin(): Plugin {
	let initialized = false;

	return new Plugin({
		key: new PluginKey("rtlAutoDetect"),

		view() {
			return {
				update: (view) => {
					if (initialized) return;
					initialized = true;

					const tr = view.state.tr;
					let modified = false;

					// One-time full pass on first mount to sync direction for the
					// initial document; per-edit passes below are range-limited.
					view.state.doc.descendants((node, pos) => {
						if (!node.type.spec.attrs?.dir) return;
						const detectedDir = detectTextDirection(node.textContent);
						const currentDir = node.attrs.dir;
						if (detectedDir && detectedDir !== currentDir) {
							tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir: detectedDir });
							modified = true;
						}
					});

					if (modified) view.dispatch(tr);
				},
			};
		},

		appendTransaction: (transactions, _oldState, newState) => {
			const ranges = collectChangedRanges(transactions);
			if (ranges.length === 0) return null;

			const tr = newState.tr;
			const docSize = newState.doc.content.size;
			const visited = new Set<number>();
			let modified = false;

			for (const range of ranges) {
				// Widen by one so a collapsed change (e.g. a deletion) still visits
				// the block that contains the join point.
				const from = Math.max(0, Math.min(range.from, docSize) - 1);
				const to = Math.min(docSize, Math.max(range.to, range.from) + 1);
				newState.doc.nodesBetween(from, to, (node, pos) => {
					if (!node.type.spec.attrs?.dir) return;
					if (visited.has(pos)) return;
					visited.add(pos);

					const nextDir = resolveBlockDir(node.textContent, node.attrs.dir);
					if (nextDir === undefined) return;
					tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir: nextDir });
					modified = true;
				});
			}

			return modified ? tr : null;
		},
	});
}

export const RTLExtension = Extension.create<RTLExtensionOptions>({
	name: "rtlExtension",

	addOptions() {
		return {
			autoDetect: true,
		};
	},

	addGlobalAttributes() {
		return [
			{
				types: ["blockContainer"],
				attributes: {
					dir: {
						default: null,
						parseHTML: (element) => element.getAttribute("dir"),
						renderHTML: (attributes) => {
							if (!attributes.dir) return {};
							return { dir: attributes.dir };
						},
					},
				},
			},
		];
	},

	addProseMirrorPlugins() {
		if (!this.options.autoDetect) return [];
		return [createRTLPlugin()];
	},
});
