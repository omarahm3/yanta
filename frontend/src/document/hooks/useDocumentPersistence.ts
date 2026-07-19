import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PERSISTED_APP_STATE_KEYS } from "../../editor/canvasScene";
import { useAutoSave } from "../../shared/hooks";
import { DocumentServiceWrapper } from "../../shared/services/DocumentService";
import type { BlockNoteBlock, DocumentKind, ExcalidrawScene } from "../../shared/types/Document";
import type { Project } from "../../shared/types/Project";
import { BackendLogger } from "../../shared/utils/backendLogger";
import { computeContentHash } from "../../shared/utils/contentHash";
import { useAutoDocumentSaver } from "./useDocumentSaver";

interface DocumentFormData {
	title: string;
	blocks: BlockNoteBlock[];
	tags: string[];
	kind: DocumentKind;
	scene?: ExcalidrawScene;
	assets?: Record<string, string>;
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

	// MRG-324: Compute blocks hash asynchronously to avoid blocking paint on every keystroke.
	// The hash is recomputed only when the blocks reference changes, and cached otherwise.
	const [blocksHash, setBlocksHash] = useState(() => computeContentHash(formData.blocks));
	const lastBlocksRef = useRef(formData.blocks);
	const pendingHashRef = useRef<number | null>(null);

	useEffect(() => {
		const cancelPending = () => {
			if (pendingHashRef.current !== null) {
				cancelAnimationFrame(pendingHashRef.current);
			}
		};

		// Only recompute when the blocks reference actually changed.
		if (formData.blocks === lastBlocksRef.current) {
			return cancelPending;
		}
		lastBlocksRef.current = formData.blocks;

		// Cancel any pending hash computation before scheduling a new one.
		cancelPending();

		// Defer hash computation to next frame to avoid blocking paint.
		pendingHashRef.current = requestAnimationFrame(() => {
			pendingHashRef.current = null;
			setBlocksHash(computeContentHash(formData.blocks));
		});

		return cancelPending;
	}, [formData.blocks]);

	// Mirror the latest form state on every render (not via an effect) so the
	// synchronous save paths — Ctrl+S and save-on-unmount — read the newest scene
	// immediately instead of one paint behind. Canvas edits propagate into formData
	// within their own event now, and this keeps doSave's snapshot current with them.
	latestFormRef.current = formData;

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
				kind: currentFormData.kind,
				scene: currentFormData.scene,
				assets: currentFormData.assets,
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

	// Canvas edits change the scene, not blocks/title/tags. Without a scene
	// signature here, useAutoSave sees "no change" and shows "saved" while the
	// drawing is actually dirty. Build a compact id:version digest rather than
	// JSON.stringify-ing every element: Excalidraw bumps an element's `version`
	// (and marks deletes with isDeleted + a version bump) on any mutation, so this
	// captures adds/edits/deletes while avoiding serializing all element geometry
	// on the render hot path for large drawings.
	const sceneKey = useMemo(() => {
		const elements = formData.scene?.elements;
		if (!elements || elements.length === 0) return "";
		let key = "";
		for (const el of elements) {
			const id = (el as { id?: string }).id ?? "";
			const version = (el as { version?: number }).version ?? 0;
			key += `${id}:${version};`;
		}
		return key;
	}, [formData.scene]);

	// The element digest above ignores appState, so an appState-only edit
	// (background color, grid/zen/snap toggles, last-used tool styles, viewport)
	// leaves the key unchanged and useAutoSave shows "saved" while the doc is dirty.
	// Digest the same whitelist that gets persisted (sanitizeAppState) so those
	// edits mark the doc dirty and get saved.
	const appStateKey = useMemo(() => {
		const appState = formData.scene?.appState;
		if (!appState) return "";
		let key = "";
		for (const k of PERSISTED_APP_STATE_KEYS) {
			key += `${k}=${JSON.stringify(appState[k])};`;
		}
		return key;
	}, [formData.scene]);

	// Assets can, in principle, change independently of the element digest (e.g. a
	// vault ref re-injected on save), so fold a stable signature of the ref map in
	// too. Small map (one entry per image), sorted for order-independence.
	const assetsKey = useMemo(() => {
		const assets = formData.assets;
		if (!assets) return "";
		return Object.keys(assets)
			.sort()
			.map((k) => `${k}=${assets[k]}`)
			.join(";");
	}, [formData.assets]);

	const compareKey = useMemo(
		() =>
			`${blocksHash}\n${formData.title}\n${formData.tags.join(",")}\n${sceneKey}\n${appStateKey}\n${assetsKey}`,
		[blocksHash, formData.title, formData.tags, sceneKey, appStateKey, assetsKey],
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
