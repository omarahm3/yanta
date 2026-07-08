import { useCallback, useEffect, useRef, useState } from "react";
import { DocumentServiceWrapper } from "../../shared/services/DocumentService";
import type { BlockNoteBlock } from "../../shared/types/Document";
import { createEmptyDocument } from "../utils/documentBlockUtils";
import { useDocumentLoader } from "./useDocumentLoader";

interface DocumentFormData {
	title: string;
	blocks: BlockNoteBlock[];
	tags: string[];
}

interface UseDocumentInitializationProps {
	documentPath?: string;
	initialTitle?: string;
	initializeForm: (data: DocumentFormData) => void;
}

export const useDocumentInitialization = ({
	documentPath,
	initialTitle,
	initializeForm,
}: UseDocumentInitializationProps) => {
	const { data, isLoading, error: loadError } = useDocumentLoader(documentPath);

	const [shouldAutoSave, setShouldAutoSave] = useState(false);
	const [documentHash, setDocumentHash] = useState<string | null>(null);
	const initializedForPathRef = useRef<string | null>(null);
	const documentPathRef = useRef<string | undefined>(documentPath);

	useEffect(() => {
		documentPathRef.current = documentPath;
	}, [documentPath]);

	useEffect(() => {
		const isEditMode = !!documentPath;

		if (isEditMode) {
			if (data && !isLoading && initializedForPathRef.current !== documentPath) {
				initializeForm({
					title: data.title,
					blocks: data.blocks,
					tags: data.tags,
				});
				initializedForPathRef.current = documentPath;

				DocumentServiceWrapper.getHash(documentPath)
					.then((hash) => {
						if (documentPathRef.current === documentPath) {
							setDocumentHash(hash);
						}
					})
					.catch(() => {
						if (documentPathRef.current === documentPath) {
							setDocumentHash(null);
						}
					});
			}
		} else {
			const newDocKey = `new:${initialTitle}`;
			if (initialTitle && initializedForPathRef.current !== newDocKey) {
				const formData = createEmptyDocument(initialTitle);
				initializeForm(formData);
				initializedForPathRef.current = newDocKey;
				setShouldAutoSave(true);
				setDocumentHash(null);
			}
		}
	}, [data, isLoading, documentPath, initialTitle, initializeForm]);

	const resetAutoSave = () => {
		setShouldAutoSave(false);
	};

	const refreshHash = useCallback(() => {
		if (documentPath) {
			return DocumentServiceWrapper.getHash(documentPath)
				.then((hash) => {
					if (documentPathRef.current === documentPath) {
						setDocumentHash(hash);
					}
				})
				.catch(() => {
					if (documentPathRef.current === documentPath) {
						setDocumentHash(null);
					}
				});
		}
		return Promise.resolve();
	}, [documentPath]);

	const updateDocumentHash = useCallback((hash: string) => {
		setDocumentHash(hash);
	}, []);

	return {
		data,
		isLoading,
		loadError,
		shouldAutoSave,
		resetAutoSave,
		documentHash,
		refreshHash,
		updateDocumentHash,
	};
};
