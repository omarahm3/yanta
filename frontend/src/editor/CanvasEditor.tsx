import {
	CaptureUpdateAction,
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
import type { CanvasHandle } from "./types";

export interface CanvasEditorProps {
	initialScene?: ExcalidrawScene;
	projectAlias: string;
	onChange?: (scene: ExcalidrawScene, assets: Record<string, string>) => void;
	/**
	 * Called once the canvas is mounted with an imperative handle (export + live
	 * interaction state), and with `null` on unmount so the consumer drops its ref.
	 */
	onCanvasReady?: (handle: CanvasHandle | null) => void;
	className?: string;
	editable?: boolean;
	/**
	 * When true, focus the Excalidraw container on mount. Excalidraw scopes its
	 * keyboard handling to a focused container, so without this the canvas never
	 * receives keys (Space-pan, tool shortcuts, Delete) until the user happens to
	 * click into it.
	 */
	autoFocus?: boolean;
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

// Excalidraw's runtime appState is mostly transient interaction state that must
// NOT survive a save/load round-trip. Persisting it raw caused two bug classes:
// class-shaped values that JSON-mangle and crash on reload (`collaborators`, a
// Map; `selectedLinearElement`, a LinearElementEditor), and in-progress
// interaction state that Excalidraw "resumes" on mount — a persisted
// `editingTextElement` makes it treat that text element as still being edited on
// reopen: the canvas hides its text and the "finish editing" banner appears.
// Whitelist the few fields that are meaningful across sessions (viewport,
// canvas settings, last-used tool styles) so no future runtime field can leak
// into persistence. Excalidraw fills everything else with defaults.
const PERSISTED_APP_STATE_KEYS = [
	"scrollX",
	"scrollY",
	"zoom",
	"viewBackgroundColor",
	"gridSize",
	"gridStep",
	"gridModeEnabled",
	"zenModeEnabled",
	"objectsSnapModeEnabled",
	"currentItemStrokeColor",
	"currentItemBackgroundColor",
	"currentItemFillStyle",
	"currentItemStrokeWidth",
	"currentItemStrokeStyle",
	"currentItemRoughness",
	"currentItemOpacity",
	"currentItemFontFamily",
	"currentItemFontSize",
	"currentItemTextAlign",
	"currentItemStartArrowhead",
	"currentItemEndArrowhead",
	"currentItemRoundness",
	"currentItemArrowType",
] as const;

function sanitizeAppState<T>(appState: T): T {
	const source = appState as unknown as Record<string, unknown>;
	const cleaned: Record<string, unknown> = {};
	for (const key of PERSISTED_APP_STATE_KEYS) {
		if (source[key] !== undefined) {
			cleaned[key] = source[key];
		}
	}
	return cleaned as unknown as T;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = React.memo(
	({
		initialScene,
		projectAlias,
		onChange,
		onCanvasReady,
		className,
		editable: _editable = true,
		autoFocus = true,
	}) => {
		const excalidrawAPI = useRef<ExcalidrawImperativeAPI | null>(null);
		const containerRef = useRef<HTMLDivElement>(null);
		const resolvedTheme = useResolvedTheme();
		const [isReady, setIsReady] = useState(false);
		// `programmaticRepaintRef` marks the font-repaint updateScene we trigger
		// ourselves (see the effect near the bottom) so its onChange isn't persisted
		// as if it were a user edit.
		const programmaticRepaintRef = useRef(false);
		const lastVersionRef = useRef<number>(0);
		const projectAliasRef = useRef(projectAlias);
		const onChangeRef = useRef(onChange);
		const onCanvasReadyRef = useRef(onCanvasReady);
		const assetsRef = useRef<Record<string, string>>({});

		projectAliasRef.current = projectAlias;
		onChangeRef.current = onChange;
		onCanvasReadyRef.current = onCanvasReady;

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
					// Sanitize on load too, not just on save: documents saved before the
					// whitelist existed already carry stale runtime state (a persisted
					// editingTextElement hides that element's text on reopen; a persisted
					// non-Map collaborators crashes InteractiveCanvas). initialData.appState
					// may be partial — Excalidraw merges in its own defaults.
					appState: sanitizeAppState(restored.appState),
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
					// Persist only the whitelisted appState so a save fired mid-interaction
					// (e.g. autosave while a text editor is open) can never freeze that
					// interaction state into the document.
					appState: sanitizeAppState(appState) as unknown as Record<string, unknown>,
					files: processedFiles as ExcalidrawScene["files"],
				};

				onChangeRef.current?.(scene, newAssets);
			},
			[],
		);

		// Propagate scene changes to the parent immediately — deliberately NOT
		// debounced here. The parent (useAutoSave) already owns the single disk-write
		// debounce (2s), and every save path — Ctrl+S, save-on-unmount, autosave,
		// window blur, flush-on-quit — persists the PARENT's form state. When
		// CanvasEditor debounced internally (1s) it sat on the latest scene before
		// calling onChange, so any save fired inside that window wrote a scene missing
		// the most recent edits, and the save-on-unmount couldn't rescue it (its React
		// state update never reaches the disk writer during teardown). That was the
		// "my last shape/text didn't save" bug. Pushing every real change up keeps the
		// parent's form state current so all of those save paths capture the newest
		// scene; the parent's own debounce still prevents excessive disk writes.
		const handleChange = useCallback(
			(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
				if (!excalidrawAPI.current) return;

				const sceneVersion = getSceneVersion(elements);
				if (sceneVersion === lastVersionRef.current) return;
				lastVersionRef.current = sceneVersion;

				// The font-repaint effect below bumps text element versions purely to
				// invalidate Excalidraw's stale render cache — not a user edit — so
				// swallow the resulting onChange instead of persisting it.
				if (programmaticRepaintRef.current) {
					programmaticRepaintRef.current = false;
					return;
				}

				// flushSave extracts any new image assets to the vault, then hands the
				// scene to onChange. It runs synchronously up to onChange when there are
				// no new files (the common shapes/text case), so the parent's form state
				// updates within this same event — before any close/save can race it.
				void flushSave(elements, appState, files);
			},
			[flushSave],
		);

		// On reopen, Excalidraw paints restored text before its custom hand-drawn font
		// finishes loading, caching a BLANK per-element bitmap. Its built-in
		// "font loaded -> invalidate + repaint" path (Fonts.onLoaded) only ever runs
		// ONCE per font per page load — a static loadedFontsCache guards it — so on
		// every reopen after the first it bails out and the blank bitmap is never
		// refreshed; the text stays blank until you edit it.
		//
		// Editing fixes it because it assigns the element a fresh versionNonce, so
		// Excalidraw treats it as a new object and regenerates both its shape
		// (ShapeCache) and bitmap (elementWithCanvasCache) — both WeakMaps keyed by
		// element identity. We reproduce that: re-stamp every text element's version
		// via the public updateScene so it repaints with the loaded font.
		// captureUpdate: NEVER keeps it out of undo/redo; the programmatic-repaint
		// guard in handleChange keeps it from being persisted. We fire it across a few
		// beats after document.fonts.ready (the face can become usable for canvas a
		// tick after `ready` resolves, and a cached font emits no `loadingdone`) and
		// again on any later `loadingdone`. It's cheap and a no-op once text is right.
		useEffect(() => {
			if (!isReady) return;
			let cancelled = false;

			const randomInteger = () => Math.floor(Math.random() * 2 ** 31);

			const repaintText = (reason: string) => {
				if (cancelled) return;
				const api = excalidrawAPI.current;
				if (!api) return;
				const elements = api.getSceneElements();
				const textEls = elements.filter((el) => el.type === "text");
				if (textEls.length === 0) return;

				// Don't clobber an in-progress text edit — Excalidraw owns that
				// element's rendering while its editor is open.
				const appState = api.getAppState();
				if (appState.editingTextElement) return;

				const fontsReady =
					typeof document !== "undefined" && document.fonts
						? document.fonts.check("20px Excalifont")
						: true;
				BackendLogger.info(
					`[canvas-font-repaint] reason=${reason} texts=${textEls.length} ` +
						`excalifontReady=${fontsReady} ` +
						`fontsStatus=${typeof document !== "undefined" ? document.fonts?.status : "n/a"} ` +
						textEls
							.map((t) => {
								const tt = t as { fontFamily?: number; width: number; height: number };
								return `{ff:${tt.fontFamily},w:${Math.round(tt.width)},h:${Math.round(tt.height)}}`;
							})
							.join(","),
				);

				const repainted = elements.map((el) =>
					el.type === "text" ? { ...el, version: el.version + 1, versionNonce: randomInteger() } : el,
				) as NonDeletedExcalidrawElement[];

				programmaticRepaintRef.current = true;
				api.updateScene({ elements: repainted, captureUpdate: CaptureUpdateAction.NEVER });
				// Never leave the guard stuck true (that would swallow a real edit). If
				// updateScene's onChange didn't clear it, a redundant bump merely gets
				// persisted once — harmless (versionNonce is just a change token).
				setTimeout(() => {
					programmaticRepaintRef.current = false;
				}, 0);
			};

			void (async () => {
				if (typeof document !== "undefined" && document.fonts) {
					try {
						await document.fonts.ready;
					} catch {
						/* ignore */
					}
				}
				for (let i = 0; i < 3; i++) {
					if (cancelled) return;
					repaintText(`ready#${i}`);
					await new Promise<void>((resolve) => {
						requestAnimationFrame(() => setTimeout(resolve, 250));
					});
				}
			})();

			const onLoadingDone = () => repaintText("loadingdone");
			if (typeof document !== "undefined" && document.fonts?.addEventListener) {
				document.fonts.addEventListener("loadingdone", onLoadingDone);
			}

			return () => {
				cancelled = true;
				if (typeof document !== "undefined" && document.fonts?.removeEventListener) {
					document.fonts.removeEventListener("loadingdone", onLoadingDone);
				}
			};
		}, [isReady]);

		// Excalidraw scopes its keyboard handling to its focused container, but in the
		// pane shell the canvas mounts without focus (keydowns land on <body>), so
		// Space-pan / tool shortcuts / Delete never reach it. Focus the container once
		// it's on screen so the canvas owns the keyboard immediately. Retry across a few
		// frames because the `.excalidraw` node isn't in the DOM the instant isReady flips.
		useEffect(() => {
			if (!isReady || !autoFocus) return;
			let cancelled = false;
			let attempts = 0;
			const focusCanvas = () => {
				if (cancelled) return;
				const el = containerRef.current?.querySelector<HTMLElement>(".excalidraw");
				if (el) {
					el.focus({ preventScroll: true });
					return;
				}
				if (attempts++ < 10) requestAnimationFrame(focusCanvas);
			};
			focusCanvas();
			return () => {
				cancelled = true;
			};
		}, [isReady, autoFocus]);

		// Excalidraw arms Space-pan via an internal isHoldingSpace flag set on Space
		// keydown — but it resets that flag on ANY window blur, and focus loss also
		// swallows the auto-repeat keydowns that would re-arm it (X11 additionally
		// synthesizes a Space keyup on focus-out). So after any transient blur, a
		// click while physically holding Space silently loses pan: at pointerdown the
		// flag is false, and once the pointer is down Excalidraw refuses to re-arm
		// (its Space handler requires zero active pointers). Track the physical key
		// ourselves and, when a left-click lands on the canvas while Space is held but
		// Excalidraw is disarmed (no grab cursor), re-arm it with a synthetic Space
		// keydown BEFORE the pointerdown reaches it — window capture runs first, and
		// at that instant its zero-pointers guard still passes.
		useEffect(() => {
			if (!isReady) return;
			const spaceHeld = { current: false };
			const isTyping = (t: EventTarget | null) =>
				t instanceof Element && Boolean(t.closest("input, textarea, [contenteditable]"));
			const cursor = () =>
				(containerRef.current?.querySelector(".excalidraw__canvas.interactive") as HTMLElement | null)
					?.style.cursor;

			const onKeyDown = (e: KeyboardEvent) => {
				if (e.key === " " && e.isTrusted && !isTyping(e.target)) spaceHeld.current = true;
			};
			const onKeyUp = (e: KeyboardEvent) => {
				if (e.key === " " && e.isTrusted) spaceHeld.current = false;
			};
			// Clear on blur: while unfocused we can't see a physical release, so a held
			// flag could go stale and cause a surprise pan later. The auto-repeat that
			// resumes on refocus re-arms us within ~30ms when Space really is still down.
			const onBlur = () => {
				spaceHeld.current = false;
			};
			const onPointerDown = (e: PointerEvent) => {
				if (e.button !== 0 || !spaceHeld.current) return;
				if (!containerRef.current?.contains(e.target as Node)) return;
				if (cursor() === "grab") return;
				document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
			};

			window.addEventListener("keydown", onKeyDown, true);
			window.addEventListener("keyup", onKeyUp, true);
			window.addEventListener("blur", onBlur);
			window.addEventListener("pointerdown", onPointerDown, true);
			return () => {
				window.removeEventListener("keydown", onKeyDown, true);
				window.removeEventListener("keyup", onKeyUp, true);
				window.removeEventListener("blur", onBlur);
				window.removeEventListener("pointerdown", onPointerDown, true);
			};
		}, [isReady]);

		// Publish an imperative handle to the parent once mounted. Everything pulls
		// from the live Excalidraw API — not the persisted scene — because getFiles()
		// returns the hydrated image dataURLs (the saved scene only keeps vault refs),
		// getSceneElements/getAppState reflect exactly what's on screen (including
		// edits still inside the autosave debounce), and only the live appState knows
		// the current interaction state used for Escape routing.
		useEffect(() => {
			if (!isReady) return;
			const handle: CanvasHandle = {
				toPNG: () => {
					const api = excalidrawAPI.current;
					if (!api) return Promise.reject(new Error("Canvas not ready"));
					return exportToBlob({
						elements: api.getSceneElements(),
						appState: api.getAppState(),
						files: api.getFiles(),
						mimeType: "image/png",
					});
				},
				toSVG: async () => {
					const api = excalidrawAPI.current;
					if (!api) throw new Error("Canvas not ready");
					const svg = await exportToSvg({
						elements: api.getSceneElements(),
						appState: api.getAppState(),
						files: api.getFiles(),
					});
					return new XMLSerializer().serializeToString(svg);
				},
				blur: () => {
					const active = document.activeElement;
					if (active instanceof HTMLElement && containerRef.current?.contains(active)) {
						active.blur();
					}
				},
			};
			onCanvasReadyRef.current?.(handle);
			return () => {
				onCanvasReadyRef.current?.(null);
			};
		}, [isReady]);

		if (!isReady || !hydratedInitialData) {
			return (
				<div className={cn("flex items-center justify-center h-full", className)}>
					<div className="text-text-dim">Loading canvas...</div>
				</div>
			);
		}

		return (
			<div ref={containerRef} className={cn("h-full w-full", className)}>
				<Excalidraw
					initialData={hydratedInitialData}
					onChange={handleChange}
					theme={resolvedTheme === "dark" ? "dark" : "light"}
					viewModeEnabled={!_editable}
					// Without this, Excalidraw binds its keyboard handler to its own
					// container, so Space-pan / tool shortcuts / Delete only work while that
					// container holds DOM focus — which it doesn't reliably in the pane shell.
					// Binding globally (to document) lets the canvas own its chords regardless.
					handleKeyboardGlobally={true}
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
