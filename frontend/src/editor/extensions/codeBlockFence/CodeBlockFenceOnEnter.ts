/**
 * BlockNote's built-in code-block input rule is `/^```(.*?)\s$/` — it fires
 * when the user types a SPACE or TAB after the fence (e.g. "```ts "). Pressing
 * ENTER after "```" does nothing: ProseMirror splits the paragraph before the
 * rule can evaluate on the newline character.
 *
 * Users (and every Markdown-style editor they know — Notion, Obsidian,
 * StackOverflow, GitHub) expect Enter after "```" (or "```lang") to convert
 * the current paragraph into a fenced code block.
 *
 * This TipTap extension adds that behavior: on Enter, if the current
 * textblock is a paragraph whose text is exactly "```" or "```<lang>" with
 * the cursor at the end, replace the paragraph with an empty codeBlock of
 * the requested language and move the cursor inside it.
 */
import { Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

const FENCE_RE = /^```([A-Za-z0-9_+#\-]*)$/;

export interface CodeBlockFenceOnEnterOptions {
	/** Resolve a user-typed language alias to a canonical language id. */
	resolveLanguage?: (input: string) => string;
	/** Default language when user typed just "```" with no name. */
	defaultLanguage?: string;
}

export const CodeBlockFenceOnEnter = Extension.create<CodeBlockFenceOnEnterOptions>({
	name: "yantaCodeBlockFenceOnEnter",

	addOptions() {
		return {
			resolveLanguage: undefined,
			defaultLanguage: "text",
		};
	},

	addKeyboardShortcuts() {
		return {
			Enter: ({ editor }) => {
				const { state } = editor;
				const { $from, empty } = state.selection;
				if (!empty) return false;

				const parent = $from.parent;
				if (parent.type.name !== "paragraph") return false;

				// Only trigger when the cursor is at the end of the paragraph —
				// otherwise Enter should behave normally (split).
				if ($from.parentOffset !== parent.content.size) return false;

				const text = parent.textContent;
				const match = text.match(FENCE_RE);
				if (!match) return false;

				const codeBlockType = state.schema.nodes.codeBlock;
				if (!codeBlockType) return false;

				const rawLang = match[1].trim();
				const resolved = rawLang
					? this.options.resolveLanguage?.(rawLang) ?? rawLang
					: this.options.defaultLanguage ?? "text";

				// Replace the whole paragraph with an empty codeBlock node.
				const paragraphStart = $from.before($from.depth);
				const paragraphEnd = $from.after($from.depth);

				return editor
					.chain()
					.focus()
					.command(({ tr, dispatch }) => {
						const codeBlockNode = codeBlockType.create({ language: resolved });
						tr.replaceWith(paragraphStart, paragraphEnd, codeBlockNode);
						// Place the cursor inside the new code block.
						const insideCodeBlock = paragraphStart + 1;
						tr.setSelection(TextSelection.create(tr.doc, insideCodeBlock));
						if (dispatch) dispatch(tr.scrollIntoView());
						return true;
					})
					.run();
			},
		};
	},
});
