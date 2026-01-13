import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface CodeBlockInputRuleOptions {
	triggerOnEnter: boolean;
}

/**
 * Pattern to match code block trigger: ``` optionally followed by a language identifier
 * Examples that match: ```, ```javascript, ```python, ```ts
 * Examples that don't match: ``, ````, text```, ``` text
 */
const CODE_BLOCK_PATTERN = /^```(\w*)$/;

/**
 * Extension that handles Enter key after triple backticks to create a code block.
 * This implements the common markdown pattern where typing ``` followed by Enter
 * creates a code block, optionally with a specified language.
 */
export const CodeBlockInputRuleExtension = Extension.create<CodeBlockInputRuleOptions>({
	name: "codeBlockInputRule",

	addOptions() {
		return {
			triggerOnEnter: true,
		};
	},

	addProseMirrorPlugins() {
		if (!this.options.triggerOnEnter) return [];

		const tiptapEditor = this.editor;

		return [
			new Plugin({
				key: new PluginKey("codeBlockInputRule"),

				props: {
					handleKeyDown(view, event) {
						// Only handle Enter key
						if (event.key !== "Enter") {
							return false;
						}

						const { state } = view;
						const { selection } = state;
						const { $from, empty } = selection;

						// Only handle when selection is collapsed (cursor, not range selection)
						if (!empty) {
							return false;
						}

						// Get the current text block
						const parentNode = $from.parent;
						if (!parentNode.isTextblock) {
							return false;
						}

						// Get the text content of the current block
						const textContent = parentNode.textContent;

						// Check if the text matches the code block pattern
						const match = textContent.match(CODE_BLOCK_PATTERN);
						if (!match) {
							return false;
						}

						// Extract the language (empty string if none specified)
						const language = match[1] || "";

						// Prevent default Enter behavior
						event.preventDefault();

						// Access BlockNote editor through TipTap's options
						// BlockNote wraps TipTap and provides blockNoteEditor in options
						const blockNoteEditor = (tiptapEditor?.options as { blockNoteEditor?: BlockNoteEditorApi })?.blockNoteEditor;

						if (!blockNoteEditor) {
							return false;
						}

						// Get the current block position
						const currentPosition = blockNoteEditor.getTextCursorPosition?.();
						const currentBlock = currentPosition?.block;

						if (!currentBlock?.id) {
							return false;
						}

						// Replace the current block (containing ```) with a code block
						try {
							blockNoteEditor.updateBlock(currentBlock.id, {
								type: "codeBlock",
								props: { language: language || "text" },
								content: undefined,
							});

							// Focus the code block after transformation
							blockNoteEditor.focus();
						} catch (error) {
							// If updateBlock fails, return false to let default behavior proceed
							return false;
						}

						return true;
					},
				},
			}),
		];
	},
});

/**
 * Type definition for BlockNote editor API methods we use.
 * This is a minimal interface to avoid importing the full BlockNote types.
 */
interface BlockNoteEditorApi {
	getTextCursorPosition?: () => { block?: { id?: string } } | undefined;
	updateBlock: (blockId: string, block: { type: string; props?: Record<string, unknown>; content?: unknown }) => void;
	focus: () => void;
}
