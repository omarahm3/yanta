import type { Block } from "@blocknote/core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAutoSave } from "../../shared/hooks";
import type { NavigationState, PageName } from "../../shared/types";
import type { BlockNoteBlock } from "../../shared/types/Document";
import type { Project } from "../../shared/types/Project";
import { BackendLogger } from "../../shared/utils/backendLogger";
import { computeContentHash } from "../../shared/utils/contentHash";
import { useAutoDocumentSaver } from "./useDocumentSaver";

interface DocumentFormData {
	title: string;
	blocks: BlockNoteBlock[];
	tags: string[];
}

interface UseDocumentPersistenceProps {
	formData: DocumentFormData;
	hasChanges: boolean;
	currentProject: Project | null | undefined;
	documentPath?: string;
	isEditMode: boolean;
	isLoading: boolean;
	shouldAutoSave: boolean;
	resetChanges: () => void;
	onAutoSaveComplete: () => void;
	onNavigate?: (page: PageName, state?: NavigationState) => void;
	isEditorReady?: boolean;
	onNewDocumentSaved?: () => void;
}

export const useDocumentPersistence = ({
	formData,
	hasChanges,
	currentProject,
	documentPath,
	isLoading,
	shouldAutoSave,
	resetChanges,
	onAutoSaveComplete,
	onNavigate,
	isEditorReady = false,
	onNewDocumentSaved,
}: UseDocumentPersistenceProps) => {
	const latestFormRef = useRef(formData);
	const currentDocumentPathRef = useRef(documentPath);
	const isSavingRef = useRef(false);

	// Compute blocks hash in layout effect to avoid formData.blocks in useMemo deps
	// (reference equality causes re-computation on every render; hash is content-based)
	const [blocksHash, setBlocksHash] = useState(() => computeContentHash(formData.blocks as Block[]));

	useLayoutEffect(() => {
		setBlocksHash(computeContentHash(formData.blocks as Block[]));
	}, [formData]);

	useEffect(() => {
		latestFormRef.current = formData;
	}, [formData]);

	useEffect(() => {
		currentDocumentPathRef.current = documentPath;
	}, [documentPath]);

	const { save } = useAutoDocumentSaver();

	const handleSave = useCallback(async () => {
		if (isSavingRef.current || !currentProject) {
			return;
		}

		isSavingRef.current = true;

		try {
			const currentFormData = latestFormRef.current;
			const currentPath = currentDocumentPathRef.current;
			const isNewDocument = !currentPath;

			const savedPath = await save({
				title: currentFormData.title,
				blocks: currentFormData.blocks,
				tags: currentFormData.tags,
				documentPath: currentPath,
				projectAlias: currentProject.alias,
			});

			if (savedPath) {
				resetChanges();
			}

			if (isNewDocument && savedPath) {
				currentDocumentPathRef.current = savedPath;
				onNewDocumentSaved?.();
			}
		} catch (err) {
			BackendLogger.error("Save failed:", err);
			throw err;
		} finally {
			isSavingRef.current = false;
		}
	}, [currentProject, save, onNavigate, resetChanges, onNewDocumentSaved]);

	useEffect(() => {
		if (shouldAutoSave && currentProject && !isLoading) {
			onAutoSaveComplete();
			handleSave().catch((err) => {
				BackendLogger.error("Auto-save failed:", err);
			});
		}
	}, [shouldAutoSave, currentProject, isLoading, handleSave, onAutoSaveComplete]);

	const compareKey = useMemo(
		() => `${blocksHash}\n${formData.title}\n${formData.tags.join(",")}`,
		[blocksHash, formData.title, formData.tags],
	);

	const autoSaveHook = useAutoSave({
		value: formData,
		onSave: handleSave,
		enabled: hasChanges && !isLoading,
		saveOnBlur: true,
		isInitialized: isEditorReady,
		compareKey,
	});

	return {
		autoSave: autoSaveHook,
	};
};
