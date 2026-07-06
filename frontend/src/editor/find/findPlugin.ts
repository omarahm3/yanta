import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { type FindMatch, findMatches } from "./findMatches";

export interface FindPluginState {
	query: string;
	caseSensitive: boolean;
	matches: FindMatch[];
	/** Index into `matches` of the current match, or -1 when there are none. */
	activeIndex: number;
	decorations: DecorationSet;
}

/** Transaction meta to drive the find plugin from React. */
export interface FindMeta {
	query?: string;
	caseSensitive?: boolean;
	/** Absolute target index; wrapped into range. Used for next/prev navigation. */
	activeIndex?: number;
}

export const findPluginKey = new PluginKey<FindPluginState>("yantaDocumentFind");

const EMPTY_STATE: FindPluginState = {
	query: "",
	caseSensitive: false,
	matches: [],
	activeIndex: -1,
	decorations: DecorationSet.empty,
};

function wrapIndex(index: number, length: number): number {
	if (length === 0) return -1;
	return ((index % length) + length) % length;
}

function buildDecorations(doc: PMNode, matches: FindMatch[], activeIndex: number): DecorationSet {
	if (matches.length === 0) return DecorationSet.empty;
	const decos = matches.map((m, i) =>
		Decoration.inline(m.from, m.to, {
			class: i === activeIndex ? "pm-find-match pm-find-match-active" : "pm-find-match",
		}),
	);
	return DecorationSet.create(doc, decos);
}

function computeState(
	doc: PMNode,
	query: string,
	caseSensitive: boolean,
	preferredIndex: number,
): FindPluginState {
	const matches = query ? findMatches(doc, query, { caseSensitive }) : [];
	const activeIndex = wrapIndex(preferredIndex, matches.length);
	return {
		query,
		caseSensitive,
		matches,
		activeIndex,
		decorations: buildDecorations(doc, matches, activeIndex),
	};
}

export interface FindPluginOptions {
	/** Called whenever the match set or active index changes, for the React UI. */
	onUpdate?: (info: { matchCount: number; activeIndex: number }) => void;
}

export function createFindPlugin(options: FindPluginOptions = {}): Plugin<FindPluginState> {
	return new Plugin<FindPluginState>({
		key: findPluginKey,
		state: {
			init: () => EMPTY_STATE,
			apply(tr, prev): FindPluginState {
				const meta = tr.getMeta(findPluginKey) as FindMeta | undefined;

				if (meta) {
					const isNavigationOnly =
						meta.activeIndex !== undefined &&
						meta.query === undefined &&
						meta.caseSensitive === undefined;

					if (isNavigationOnly) {
						const activeIndex = wrapIndex(meta.activeIndex as number, prev.matches.length);
						return {
							...prev,
							activeIndex,
							decorations: buildDecorations(tr.doc, prev.matches, activeIndex),
						};
					}

					return computeState(
						tr.doc,
						meta.query ?? prev.query,
						meta.caseSensitive ?? prev.caseSensitive,
						meta.activeIndex ?? 0,
					);
				}

				// Doc edited while find is open — re-find so highlight positions stay valid.
				if (tr.docChanged && prev.query) {
					return computeState(tr.doc, prev.query, prev.caseSensitive, prev.activeIndex);
				}

				return prev;
			},
		},
		props: {
			decorations(state) {
				return findPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
			},
		},
		view() {
			return {
				update(view, prevState) {
					const prev = findPluginKey.getState(prevState);
					const curr = findPluginKey.getState(view.state);
					if (!curr) return;
					if (!prev || prev.matches !== curr.matches || prev.activeIndex !== curr.activeIndex) {
						options.onUpdate?.({ matchCount: curr.matches.length, activeIndex: curr.activeIndex });
					}
				},
			};
		},
	});
}
