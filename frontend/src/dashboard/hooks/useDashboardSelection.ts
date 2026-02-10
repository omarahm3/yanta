import { useCallback, useEffect, useRef, useState } from "react";
import type { Document } from "../../types/Document";

export interface UseDashboardSelectionOptions {
	documentsRef: React.RefObject<Document[]>;
	highlightedIndexRef: React.RefObject<number>;
	setHighlightedIndex: (index: number) => void;
}

export interface UseDashboardSelectionResult {
	selectedDocuments: Set<string>;
	selectedDocumentsRef: React.MutableRefObject<Set<string>>;
	handleToggleSelection: (path?: string) => void;
	clearSelection: () => void;
}

export function useDashboardSelection({
	documentsRef,
	highlightedIndexRef,
	setHighlightedIndex,
}: UseDashboardSelectionOptions): UseDashboardSelectionResult {
	const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
	const selectedDocumentsRef = useRef<Set<string>>(new Set()) as React.MutableRefObject<Set<string>>;

	useEffect(() => {
		selectedDocumentsRef.current = selectedDocuments;
	}, [selectedDocuments]);

	const clearSelection = useCallback(() => {
		setSelectedDocuments(new Set());
	}, []);

	const handleToggleSelection = useCallback(
		(path?: string) => {
			const documents = documentsRef.current ?? [];
			const hi = highlightedIndexRef.current ?? -1;
			let targetDoc: Document | null = null;
			if (path) {
				const docIndex = documents.findIndex((doc) => doc.path === path);
				if (docIndex !== -1) {
					targetDoc = documents[docIndex];
					setHighlightedIndex(docIndex);
				}
			} else if (hi >= 0 && hi < documents.length) {
				targetDoc = documents[hi];
			}

			if (!targetDoc) return;

			const docPath = targetDoc.path;

			setSelectedDocuments((prev) => {
				const next = new Set(prev);
				if (next.has(docPath)) {
					next.delete(docPath);
				} else {
					next.add(docPath);
				}
				return next;
			});
		},
		[documentsRef, highlightedIndexRef, setHighlightedIndex],
	);

	return {
		selectedDocuments,
		selectedDocumentsRef,
		handleToggleSelection,
		clearSelection,
	};
}
