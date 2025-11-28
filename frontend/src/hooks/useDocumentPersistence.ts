import { useCallback, useEffect, useRef } from "react";
import type { BlockNoteBlock } from "../types/Document";
import type { Project } from "../types/Project";
import { useAutoSave } from "./useAutoSave";
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
	onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
	isEditorReady?: boolean;
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

		console.log("> saving document", JSON.stringify(latestFormRef.current.blocks));

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
			}
		} catch (err) {
			console.error("Save failed:", err);
			// Re-throw the error so useAutoSave can handle it and show error status
			// This is safe because useAutoSave has its own try-catch that prevents crashes
			throw err;
		} finally {
			isSavingRef.current = false;
		}
	}, [currentProject, save, onNavigate, resetChanges]);

	useEffect(() => {
		if (shouldAutoSave && currentProject && !isLoading) {
			console.log("[useDocumentPersistence] shouldAutoSave triggered immediate save");
			onAutoSaveComplete();
			handleSave().catch((err) => {
				console.error("Auto-save failed:", err);
			});
		}
	}, [shouldAutoSave, currentProject, isLoading, handleSave, onAutoSaveComplete]);

	console.log("[useDocumentPersistence] render", {
		hasChanges,
		isLoading,
		isEditorReady,
		enabled: hasChanges && !isLoading,
	});

	const autoSaveHook = useAutoSave({
		value: formData,
		onSave: handleSave,
		delay: 2000,
		enabled: hasChanges && !isLoading,
		saveOnBlur: true,
		isInitialized: isEditorReady,
	});

	return {
		autoSave: autoSaveHook,
	};
};
