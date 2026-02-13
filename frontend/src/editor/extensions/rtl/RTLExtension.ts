import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { detectTextDirection } from "./textDirection";

export interface RTLExtensionOptions {
	autoDetect: boolean;
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

		let initialized = false;

		return [
			new Plugin({
				key: new PluginKey("rtlAutoDetect"),

				view() {
					return {
						update: (view) => {
							if (!initialized) {
								initialized = true;
								const tr = view.state.tr;
								let modified = false;

								view.state.doc.descendants((node, pos) => {
									if (!node.type.spec.attrs?.dir) return;

									const textContent = node.textContent;
									if (!textContent || textContent.trim().length === 0) return;

									const detectedDir = detectTextDirection(textContent);
									const currentDir = node.attrs.dir;

									if (detectedDir && detectedDir !== currentDir) {
										tr.setNodeMarkup(pos, undefined, {
											...node.attrs,
											dir: detectedDir,
										});
										modified = true;
									}
								});

								if (modified) view.dispatch(tr);
							}
						},
					};
				},

				appendTransaction: (transactions, _oldState, newState) => {
					const docChanged = transactions.some((tr) => tr.docChanged);
					if (!docChanged) return null;

					const tr = newState.tr;
					let modified = false;

					newState.doc.descendants((node, pos) => {
						if (!node.type.spec.attrs?.dir) return;

						const textContent = node.textContent;
						if (!textContent || textContent.trim().length === 0) {
							if (node.attrs.dir) {
								tr.setNodeMarkup(pos, undefined, {
									...node.attrs,
									dir: null,
								});
								modified = true;
							}
							return;
						}

						const detectedDir = detectTextDirection(textContent);
						const currentDir = node.attrs.dir;

						if (detectedDir && detectedDir !== currentDir) {
							tr.setNodeMarkup(pos, undefined, {
								...node.attrs,
								dir: detectedDir,
							});
							modified = true;
						}
					});

					return modified ? tr : null;
				},
			}),
		];
	},
});
