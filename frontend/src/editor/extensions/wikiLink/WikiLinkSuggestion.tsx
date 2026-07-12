import type { BlockNoteEditor } from "@blocknote/core";
import { SuggestionMenuController } from "@blocknote/react";
import type React from "react";
import { useCallback, useMemo } from "react";
import { useSearchIndexStore } from "../../../search-index/searchIndex.store";

interface WikiLinkSuggestionProps {
	editor: BlockNoteEditor;
	editable: boolean;
}

interface DocSuggestion {
	title: string;
	path: string;
}

export const WikiLinkSuggestion: React.FC<WikiLinkSuggestionProps> = ({ editor, editable }) => {
	const docsById = useSearchIndexStore((s) => s.docsById);
	const status = useSearchIndexStore((s) => s.status);

	const suggestions = useMemo<DocSuggestion[]>(() => {
		if (status !== "ready") return [];
		return Array.from(docsById.values()).map((doc) => ({
			title: doc.title || "Untitled",
			path: doc.id,
		}));
	}, [docsById, status]);

	const getItems = useCallback(
		async (query: string) => {
			const lowerQuery = query.toLowerCase();
			return suggestions
				.filter((s) => s.title.toLowerCase().includes(lowerQuery))
				.slice(0, 10)
				.map((s) => ({
					...s,
					onItemClick: () => {
						insertWikiLink(editor, s.title);
					},
				}));
		},
		[suggestions, editor],
	);

	if (!editable) return null;

	return <SuggestionMenuController triggerCharacter="[" getItems={getItems} />;
};

function insertWikiLink(editor: BlockNoteEditor, title: string) {
	const selection = editor.getSelection();
	if (!selection || selection.blocks.length === 0) return;

	editor.insertInlineContent(`[[${title}]]`);
}
