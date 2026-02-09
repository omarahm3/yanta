import type { Block } from "@blocknote/core";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { TIMEOUTS } from "@/config";
import { useAutoSave } from "../../hooks/useAutoSave";
import type { NavigationState } from "../../types";
import type { BlockNoteBlock } from "../../types/Document";
import type { Project } from "../../types/Project";
import { BackendLogger } from "../../utils/backendLogger";
import { computeContentHash } from "../../utils/contentHash";
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
	onNavigate?: (page: string, state?: NavigationState) => void;
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
		() =>
			`${computeContentHash(formData.blocks as Block[])}\n${formData.title}\n${formData.tags.join(",")}`,
		[formData.blocks, formData.title, formData.tags],
	);

	const autoSaveHook = useAutoSave({
		value: formData,
		onSave: handleSave,
		delay: TIMEOUTS.autoSaveDebounceMs,
		enabled: hasChanges && !isLoading,
		saveOnBlur: true,
		isInitialized: isEditorReady,
		compareKey,
	});

	return {
		autoSave: autoSaveHook,
	};
};
