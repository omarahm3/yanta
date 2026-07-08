import { TextSelection } from "prosemirror-state";
import { useCallback, useEffect, useState } from "react";
import {
	getTiptapEditor,
	isEditorAlive,
	isEditorViewUnavailableError,
} from "../../shared/utils/blocknoteInternals";
import type { EditorHandle } from "../types";
import { createFindPlugin, type FindMeta, findPluginKey } from "./findPlugin";
import { applyReplaceAll, applyReplaceOne } from "./replace";

export interface EditorFindApi {
	query: string;
	caseSensitive: boolean;
	matchCount: number;
	/** 0-based index of the current match, or -1 when there are none. */
	activeIndex: number;
	replaceValue: string;
	setQuery: (query: string) => void;
	toggleCaseSensitive: () => void;
	next: () => void;
	prev: () => void;
	setReplaceValue: (value: string) => void;
	/** Replace the active match and advance to the next one. */
	replaceCurrent: () => void;
	/** Replace every match in one transaction. */
	replaceAll: () => void;
}

/**
 * Drives in-document find for a live BlockNote editor. Registers the find
 * decoration plugin for the hook's lifetime (so mounting the find bar turns
 * highlighting on and unmounting turns it off), exposes the query/case/count
 * state for the UI, and scrolls the active match into view without moving the
 * text cursor. Mirrors the plugin-registration lifecycle in
 * `shared/utils/clipboard.ts` and is guarded by `blocknoteInternals` helpers.
 */
export function useEditorFind(editor: EditorHandle): EditorFindApi {
	const [query, setQueryState] = useState("");
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [matchCount, setMatchCount] = useState(0);
	const [activeIndex, setActiveIndex] = useState(-1);
	const [replaceValue, setReplaceValueState] = useState("");

	useEffect(() => {
		const tiptap = getTiptapEditor(editor);
		if (!tiptap) return;

		const plugin = createFindPlugin({
			onUpdate: (info) => {
				setMatchCount(info.matchCount);
				setActiveIndex(info.activeIndex);
			},
		});

		let active = true;
		let registered = false;
		let rafId: number | null = null;

		const register = () => {
			if (!active || tiptap.isDestroyed) return;
			if (!tiptap.isInitialized) {
				rafId = requestAnimationFrame(register);
				return;
			}
			try {
				tiptap.registerPlugin(plugin);
				registered = true;
			} catch (err) {
				if (isEditorViewUnavailableError(err)) {
					rafId = requestAnimationFrame(register);
					return;
				}
				console.warn("[find] registerPlugin failed:", err);
			}
		};
		register();

		return () => {
			active = false;
			if (rafId !== null) cancelAnimationFrame(rafId);
			if (!registered || tiptap.isDestroyed) return;
			try {
				tiptap.unregisterPlugin(findPluginKey);
			} catch (err) {
				console.warn("[find] unregisterPlugin failed:", err);
			}
		};
	}, [editor]);

	const dispatchAndScroll = useCallback(
		(meta: FindMeta) => {
			if (!isEditorAlive(editor)) return;
			const view = editor.prosemirrorView;
			if (!view) return;

			view.dispatch(view.state.tr.setMeta(findPluginKey, meta));

			const state = findPluginKey.getState(view.state);
			if (!state || state.activeIndex < 0) return;
			const match = state.matches[state.activeIndex];
			if (!match) return;

			// Move the editor selection onto the active match so the caret lands there
			// when focus returns to the editor (on close/accept), and scroll it into
			// view. The find input keeps DOM focus, so this doesn't steal the cursor.
			try {
				const selection = TextSelection.create(view.state.doc, match.from, match.to);
				view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
			} catch {
				// Fall back to a best-effort scroll if the selection can't be built on a
				// transient view; the highlight decoration is still applied.
				try {
					const { node } = view.domAtPos(match.from);
					const el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
					el?.scrollIntoView({ block: "center", inline: "nearest" });
				} catch {
					// domAtPos can throw on a transient view; nothing else to do.
				}
			}
		},
		[editor],
	);

	const setQuery = useCallback(
		(next: string) => {
			setQueryState(next);
			dispatchAndScroll({ query: next, activeIndex: 0 });
		},
		[dispatchAndScroll],
	);

	const toggleCaseSensitive = useCallback(() => {
		setCaseSensitive((prev) => {
			const nextValue = !prev;
			dispatchAndScroll({ caseSensitive: nextValue, activeIndex: 0 });
			return nextValue;
		});
	}, [dispatchAndScroll]);

	const step = useCallback(
		(delta: number) => {
			if (!isEditorAlive(editor)) return;
			const view = editor.prosemirrorView;
			if (!view) return;
			const current = findPluginKey.getState(view.state)?.activeIndex ?? -1;
			dispatchAndScroll({ activeIndex: current + delta });
		},
		[editor, dispatchAndScroll],
	);

	const next = useCallback(() => step(1), [step]);
	const prev = useCallback(() => step(-1), [step]);

	const setReplaceValue = useCallback((value: string) => setReplaceValueState(value), []);

	const replaceCurrent = useCallback(() => {
		if (!isEditorAlive(editor)) return;
		const view = editor.prosemirrorView;
		if (!view) return;
		const state = findPluginKey.getState(view.state);
		if (!state || state.activeIndex < 0) return;
		const match = state.matches[state.activeIndex];
		if (!match) return;

		const targetIndex = state.activeIndex;
		view.dispatch(applyReplaceOne(view.state.tr, match, replaceValue));
		// The doc-changed re-find recomputes the match set; navigate to whatever now
		// sits at the same index (the following occurrence) and scroll/select it.
		dispatchAndScroll({ activeIndex: targetIndex });
	}, [editor, replaceValue, dispatchAndScroll]);

	const replaceAll = useCallback(() => {
		if (!isEditorAlive(editor)) return;
		const view = editor.prosemirrorView;
		if (!view) return;
		const state = findPluginKey.getState(view.state);
		if (!state || state.matches.length === 0) return;

		view.dispatch(applyReplaceAll(view.state.tr, state.matches, replaceValue));
	}, [editor, replaceValue]);

	return {
		query,
		caseSensitive,
		matchCount,
		activeIndex,
		replaceValue,
		setQuery,
		toggleCaseSensitive,
		next,
		prev,
		setReplaceValue,
		replaceCurrent,
		replaceAll,
	};
}
