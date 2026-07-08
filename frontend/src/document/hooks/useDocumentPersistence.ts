import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAutoSave } from "../../shared/hooks";
import { DocumentServiceWrapper } from "../../shared/services/DocumentService";
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
	isEditorReady?: boolean;
	onNewDocumentSaved?: () => void;
	documentHash?: string | null;
	onConflict?: () => void;
	onSaveComplete?: (newHash: string) => void;
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
	isEditorReady = false,
	onNewDocumentSaved,
	documentHash,
	onConflict,
	onSaveComplete,
}: UseDocumentPersistenceProps) => {
	const latestFormRef = useRef(formData);
	const currentDocumentPathRef = useRef(documentPath);
	const savingChainRef = useRef<Promise<void>>(Promise.resolve());

	// Compute blocks hash in layout effect to avoid formData.blocks in useMemo deps
	// (reference equality causes re-computation on every render; hash is content-based)
	const [blocksHash, setBlocksHash] = useState(() => computeContentHash(formData.blocks));

	useLayoutEffect(() => {
		setBlocksHash(computeContentHash(formData.blocks));
	}, [formData]);

	useEffect(() => {
		latestFormRef.current = formData;
	}, [formData]);

	useEffect(() => {
		currentDocumentPathRef.current = documentPath;
	}, [documentPath]);

	const { save } = useAutoDocumentSaver();

	const doSave = useCallback(async () => {
		if (!currentProject) {
			return;
		}

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
				expectedHash: documentHash || undefined,
			});

			if (savedPath) {
				resetChanges();

				if (isNewDocument) {
					currentDocumentPathRef.current = savedPath;
					onNewDocumentSaved?.();
				}

				try {
					const newHash = await DocumentServiceWrapper.getHash(savedPath);
					onSaveComplete?.(newHash);
				} catch (err) {
					BackendLogger.error("Failed to fetch document hash after save:", err);
				}
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (message.includes("ERR_CONFLICT")) {
				onConflict?.();
				return;
			}
			BackendLogger.error("Save failed:", err);
			throw err;
		}
	}, [
		currentProject,
		save,
		resetChanges,
		onNewDocumentSaved,
		documentHash,
		onConflict,
		onSaveComplete,
	]);

	// Serialize saves: overlapping callers (autosave debounce + the new-document
	// direct-save effect) chain instead of racing. Each run reads the latest form
	// state, so nothing is lost and a queued call can never resolve as a silent
	// no-op that would falsely clear the dirty flag.
	const handleSave = useCallback(async () => {
		const run = savingChainRef.current.catch(() => {}).then(() => doSave());
		savingChainRef.current = run;
		return run;
	}, [doSave]);

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
