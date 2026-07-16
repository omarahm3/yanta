import {
	Excalidraw,
	exportToBlob,
	exportToSvg,
	getSceneVersion,
	restore,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type {
	ExcalidrawElement,
	NonDeletedExcalidrawElement,
} from "@excalidraw/excalidraw/element/types";
import type {
	AppState,
	BinaryFiles,
	ExcalidrawImperativeAPI,
	ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ResolveDataURL, StoreDataURL } from "../../bindings/yanta/internal/asset/service";
import { useResolvedTheme } from "../shared/stores/theme.store";
import type { ExcalidrawScene } from "../shared/types/Document";
import { BackendLogger } from "../shared/utils/backendLogger";
import { cn } from "../shared/utils/cn";

export interface CanvasEditorProps {
	initialScene?: ExcalidrawScene;
	projectAlias: string;
	onChange?: (scene: ExcalidrawScene, assets: Record<string, string>) => void;
	className?: string;
	editable?: boolean;
}

interface HydratedFiles {
	[id: string]: {
		id: string;
		dataURL: string;
		mimeType: string;
		created: number;
		lastRetrieved?: number;
	};
}

type ExcalidrawFile = {
	dataURL?: string;
	mimeType?: string;
	vaultRef?: string;
	[key: string]: unknown;
};

// Excalidraw's appState carries runtime-only fields that don't survive JSON
// (notably `collaborators`, a Map that serializes to {} and then crashes
// InteractiveCanvas on mount). Remove them so what we persist and what we hand
// back to Excalidraw is plain, safe data.
function stripRuntimeAppState<T>(appState: T): T {
	const cleaned = { ...(appState as unknown as Record<string, unknown>) };
	delete cleaned.collaborators;
	return cleaned as unknown as T;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = React.memo(
	({ initialScene, projectAlias, onChange, className, editable: _editable = true }) => {
		const excalidrawAPI = useRef<ExcalidrawImperativeAPI | null>(null);
		const resolvedTheme = useResolvedTheme();
		const [isReady, setIsReady] = useState(false);
		// Bumped once after mount to remount Excalidraw with a fresh render cache so
		// restored text repaints with the (now-loaded) custom font. See below.
		const [fontRepaintKey, setFontRepaintKey] = useState(0);
		const fontRepaintDoneRef = useRef(false);
		const lastVersionRef = useRef<number>(0);
		const projectAliasRef = useRef(projectAlias);
		const onChangeRef = useRef(onChange);
		const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const assetsRef = useRef<Record<string, string>>({});
		const pendingSaveRef = useRef<{
			elements: readonly ExcalidrawElement[];
			appState: AppState;
			files: BinaryFiles;
		} | null>(null);

		projectAliasRef.current = projectAlias;
		onChangeRef.current = onChange;

		// Hydrate vault references to dataURLs on mount
		const [hydratedInitialData, setHydratedInitialData] = useState<ExcalidrawInitialDataState | null>(
			null,
		);

		useEffect(() => {
			const hydrateAssets = async () => {
				if (!initialScene) {
					setHydratedInitialData({
						elements: [],
						appState: {},
						files: {},
					});
					setIsReady(true);
					return;
				}

				const files: HydratedFiles = {};
				const assets: Record<string, string> = {};

				// Hydrate files from vault references
				if (initialScene.files) {
					for (const [fileId, file] of Object.entries(initialScene.files)) {
						const fileObj = file as ExcalidrawFile;
						if (fileObj.dataURL) {
							// Already a dataURL (legacy or direct)
							files[fileId] = {
								id: fileId,
								dataURL: fileObj.dataURL,
								mimeType: fileObj.mimeType || "image/png",
								created: Date.now(),
							};
						} else {
							// Try to resolve from vault reference
							const ref = fileObj.vaultRef;
							if (ref) {
								try {
									const dataURL = await ResolveDataURL(projectAliasRef.current, ref);
									files[fileId] = {
										id: fileId,
										dataURL,
										mimeType: fileObj.mimeType || "image/png",
										created: Date.now(),
									};
									assets[fileId] = ref;
								} catch (err) {
									BackendLogger.error(`Failed to resolve asset ${fileId}:`, err);
								}
							}
						}
					}
				}

				assetsRef.current = assets;

				// Run persisted data through Excalidraw's restoration layer. Our stored
				// appState is a plain JSON object, but Excalidraw expects runtime types
				// (e.g. appState.collaborators must be a Map, not {}), so mounting the raw
				// object crashes InteractiveCanvas. restore() normalizes appState, repairs
				// element bindings, and migrates older schemas.
				const restored = restore(
					{
						elements: initialScene.elements as NonDeletedExcalidrawElement[],
						appState: initialScene.appState as unknown as AppState,
						files: files as unknown as BinaryFiles,
					},
					null,
					null,
				);

				setHydratedInitialData({
					elements: restored.elements,
					// Excalidraw copies appState.collaborators verbatim and only falls back
					// to a fresh Map when the key is absent; our persisted {} is not a Map and
					// crashes InteractiveCanvas. Drop it so Excalidraw supplies its own.
					appState: stripRuntimeAppState(restored.appState),
					files: restored.files,
				});
				setIsReady(true);
			};

			void hydrateAssets();
		}, [initialScene]);

		// Flush pending save - called from timeout or cleanup
		const flushSave = useCallback(
			async (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
				const newAssets: Record<string, string> = { ...assetsRef.current };
				const processedFiles: Record<string, unknown> = {};

				// Process files - extract dataURLs to vault
				for (const [fileId, file] of Object.entries(files)) {
					if (file.dataURL && !newAssets[fileId]) {
						// New file - store to vault
						try {
							const ref = await StoreDataURL(projectAliasRef.current, file.dataURL);
							newAssets[fileId] = ref;
							processedFiles[fileId] = {
								...file,
								vaultRef: ref,
								// Remove dataURL to keep scene JSON small
								dataURL: undefined,
							};
						} catch (err) {
							BackendLogger.error(`Failed to store asset ${fileId}:`, err);
							// Keep dataURL inline if storage fails
							processedFiles[fileId] = file;
						}
					} else if (newAssets[fileId]) {
						// Already stored - just keep the reference
						processedFiles[fileId] = {
							...file,
							vaultRef: newAssets[fileId],
							dataURL: undefined,
						};
					} else {
						processedFiles[fileId] = file;
					}
				}

				// Remove assets that are no longer in the scene
				const currentFileIds = new Set(Object.keys(files));
				for (const fileId of Object.keys(newAssets)) {
					if (!currentFileIds.has(fileId)) {
						delete newAssets[fileId];
					}
				}

				assetsRef.current = newAssets;

				const scene: ExcalidrawScene = {
					elements: elements as ExcalidrawElement[],
					// Strip runtime-only appState (e.g. collaborators, a Map) before persisting
					// so the stored JSON stays clean and reload never sees a non-Map value.
					appState: stripRuntimeAppState(appState) as unknown as Record<string, unknown>,
					files: processedFiles as ExcalidrawScene["files"],
				};

				onChangeRef.current?.(scene, newAssets);
			},
			[],
		);

		// Extract dataURLs to vault assets on change
		const handleChange = useCallback(
			async (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
				if (!excalidrawAPI.current) return;

				const sceneVersion = getSceneVersion(elements);
				if (sceneVersion === lastVersionRef.current) return;
				lastVersionRef.current = sceneVersion;

				// Store pending save data
				pendingSaveRef.current = { elements, appState, files };

				// Debounce the save
				if (saveTimeoutRef.current) {
					clearTimeout(saveTimeoutRef.current);
				}

				saveTimeoutRef.current = setTimeout(async () => {
					await flushSave(elements, appState, files);
					pendingSaveRef.current = null;
				}, 1000);
			},
			[flushSave],
		);

		// Cleanup: flush pending save on unmount
		useEffect(() => {
			return () => {
				if (saveTimeoutRef.current) {
					clearTimeout(saveTimeoutRef.current);
					// Flush pending save synchronously
					if (pendingSaveRef.current) {
						const { elements, appState, files } = pendingSaveRef.current;
						void flushSave(elements, appState, files);
					}
				}
			};
		}, [flushSave]);

		// Excalidraw caches a per-element bitmap keyed by version. On reopen, text is
		// painted before its custom font (Excalifont) is ready and a BLANK bitmap is
		// cached; because the font is served from cache, Excalidraw's internal
		// font-loaded handler fires before the scene exists, so that blank cache is
		// never invalidated (text stays blank until you edit the element). The public
		// API exposes no cache-invalidation hook, so we remount Excalidraw ONCE with
		// the live scene captured: a fresh instance has an empty cache and paints text
		// with the now-loaded font on first frame. Only fires when the opened scene
		// already contains text (the only case that can be blank), and captures live
		// elements so any edits made in the first moments survive the remount.
		const repaintTextForFonts = useCallback(() => {
			if (fontRepaintDoneRef.current) return;
			const api = excalidrawAPI.current;
			if (!api) return;
			const elements = api.getSceneElements();
			fontRepaintDoneRef.current = true;
			if (!elements.some((el) => el.type === "text")) return;
			setHydratedInitialData({
				elements: elements as NonDeletedExcalidrawElement[],
				appState: stripRuntimeAppState(api.getAppState()),
				files: api.getFiles(),
			});
			setFontRepaintKey((k) => k + 1);
		}, []);

		// Trigger the one-time font repaint once fonts are ready (near-instant for a
		// cached font), with a short fallback in case the ready event already fired.
		useEffect(() => {
			if (!isReady) return;
			let cancelled = false;
			const run = () => {
				if (!cancelled) repaintTextForFonts();
			};
			if (typeof document !== "undefined" && document.fonts?.ready) {
				document.fonts.ready.then(run).catch(() => {});
			}
			const timer = setTimeout(run, 500);
			return () => {
				cancelled = true;
				clearTimeout(timer);
			};
		}, [isReady, repaintTextForFonts]);

		if (!isReady || !hydratedInitialData) {
			return (
				<div className={cn("flex items-center justify-center h-full", className)}>
					<div className="text-text-dim">Loading canvas...</div>
				</div>
			);
		}

		return (
			<div className={cn("h-full w-full", className)}>
				<Excalidraw
					key={fontRepaintKey}
					initialData={hydratedInitialData}
					onChange={handleChange}
					theme={resolvedTheme === "dark" ? "dark" : "light"}
					viewModeEnabled={!_editable}
					UIOptions={{
						canvasActions: {
							saveToActiveFile: false,
							loadScene: false,
							export: { saveFileToDisk: true },
						},
					}}
					excalidrawAPI={(api) => {
						excalidrawAPI.current = api;
					}}
				/>
			</div>
		);
	},
);

CanvasEditor.displayName = "CanvasEditor";

// Export utilities for PNG/SVG export
export async function exportCanvasToPNG(scene: ExcalidrawScene, files: BinaryFiles): Promise<Blob> {
	return exportToBlob({
		elements: scene.elements as NonDeletedExcalidrawElement[],
		appState: scene.appState as unknown as AppState,
		files,
		mimeType: "image/png",
	});
}

export async function exportCanvasToSVG(
	scene: ExcalidrawScene,
	files: BinaryFiles,
): Promise<SVGSVGElement> {
	return exportToSvg({
		elements: scene.elements as NonDeletedExcalidrawElement[],
		appState: scene.appState as unknown as AppState,
		files,
	});
}
