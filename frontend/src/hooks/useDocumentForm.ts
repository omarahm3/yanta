import { useCallback, useState } from "react";
import type { BlockNoteBlock } from "../types/Document";
import { extractTitleFromBlocks } from "../utils/documentUtils";

interface DocumentFormData {
	title: string;
	blocks: BlockNoteBlock[];
	tags: string[];
}

const DEFAULT_FORM_DATA: DocumentFormData = {
	title: "",
	blocks: [],
	tags: [],
};

export const useDocumentForm = (initialData?: DocumentFormData) => {
	const [formData, setFormData] = useState<DocumentFormData>(() =>
		initialData ? { ...initialData } : { ...DEFAULT_FORM_DATA },
	);
	const [hasChanges, setHasChanges] = useState(false);

	const updateFormData = useCallback((updater: (prev: DocumentFormData) => DocumentFormData) => {
		setFormData((prev) => {
			const next = updater(prev);
			if (prev === next) {
				return prev;
			}
			setHasChanges((current) => (current ? current : true));
			return next;
		});
	}, []);

	const setTitle = useCallback(
		(title: string) => {
			updateFormData((prev) => {
				if (prev.title === title) {
					return prev;
				}
				return { ...prev, title };
			});
		},
		[updateFormData],
	);

	const setBlocks = useCallback(
		(blocks: BlockNoteBlock[]) => {
			console.log("[useDocumentForm] setBlocks called", { blockCount: blocks.length });
			updateFormData((prev) => ({
				...prev,
				blocks,
				title: extractTitleFromBlocks(blocks),
			}));
		},
		[updateFormData],
	);

	const removeTag = useCallback(
		(tag: string) => {
			updateFormData((prev) => {
				if (!prev.tags.includes(tag)) {
					return prev;
				}
				return {
					...prev,
					tags: prev.tags.filter((t) => t !== tag),
				};
			});
		},
		[updateFormData],
	);

	const setTags = useCallback(
		(tags: string[]) => {
			updateFormData((prev) => {
				const sortedPrevTags = [...prev.tags].sort();
				const sortedNewTags = [...tags].sort();

				if (
					sortedPrevTags.length === sortedNewTags.length &&
					sortedPrevTags.every((tag, i) => tag === sortedNewTags[i])
				) {
					return prev;
				}

				return {
					...prev,
					tags: [...tags],
				};
			});
		},
		[updateFormData],
	);

	const initializeForm = useCallback((data: DocumentFormData) => {
		const title = data.title || extractTitleFromBlocks(data.blocks);
		const formData = { ...data, title };

		setFormData(formData);
		setHasChanges(false);
	}, []);

	const resetChanges = useCallback(() => {
		setHasChanges(false);
	}, []);

	const getFormData = useCallback(() => formData, [formData]);

	return {
		formData,
		hasChanges,
		setTitle,
		setBlocks,
		removeTag,
		setTags,
		initializeForm,
		resetChanges,
		getFormData,
	};
};
