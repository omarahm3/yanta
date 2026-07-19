import type { AppState } from "@excalidraw/excalidraw/types";

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
export const PERSISTED_APP_STATE_KEYS = [
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

export function sanitizeAppState<T>(appState: T): T {
	const source = appState as unknown as Record<string, unknown>;
	const cleaned: Record<string, unknown> = {};
	for (const key of PERSISTED_APP_STATE_KEYS) {
		if (source[key] !== undefined) {
			cleaned[key] = source[key];
		}
	}
	return cleaned as unknown as T;
}

// Persisted appState keys that change at LOW frequency — used to detect
// appState-only edits (background color, grid/zen/snap toggles, last-used tool
// styles) that don't bump any element version and would otherwise never trigger
// a save. Deliberately EXCLUDES scrollX/scrollY/zoom: those change every
// pan/zoom frame, so including them would fire onChange ~60x/sec. Viewport is
// still captured into the saved scene whenever any other change triggers a save.
export const APP_STATE_SIGNATURE_KEYS = PERSISTED_APP_STATE_KEYS.filter(
	(key) => key !== "scrollX" && key !== "scrollY" && key !== "zoom",
);

export function appStateSignature(appState: AppState): string {
	const source = appState as unknown as Record<string, unknown>;
	let sig = "";
	for (const key of APP_STATE_SIGNATURE_KEYS) {
		sig += `${key}=${JSON.stringify(source[key])};`;
	}
	return sig;
}

// The fileIds referenced by live image elements. Excalidraw keeps file-map
// entries for deleted images, so callers that need "still in use" must key off
// the elements, not the file map.
export function referencedImageFileIds(
	elements: readonly { type?: string; fileId?: string }[],
): Set<string> {
	return new Set(
		elements
			.filter((el) => el.type === "image")
			.map((el) => el.fileId)
			.filter((id): id is string => Boolean(id)),
	);
}
