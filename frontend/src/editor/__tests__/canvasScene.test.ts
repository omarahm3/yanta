import type { AppState } from "@excalidraw/excalidraw/types";
import { describe, expect, it } from "vitest";
import {
	APP_STATE_SIGNATURE_KEYS,
	appStateSignature,
	PERSISTED_APP_STATE_KEYS,
	referencedImageFileIds,
	sanitizeAppState,
} from "../canvasScene";

const asAppState = (o: Record<string, unknown>) => o as unknown as AppState;

describe("sanitizeAppState", () => {
	it("keeps only whitelisted keys", () => {
		const raw = {
			scrollX: 10,
			zoom: { value: 2 },
			viewBackgroundColor: "#fff",
			// runtime state that must NOT persist:
			collaborators: new Map(),
			editingTextElement: { id: "x" },
			selectedElementIds: { a: true },
		};
		const cleaned = sanitizeAppState(raw) as Record<string, unknown>;
		expect(cleaned.scrollX).toBe(10);
		expect(cleaned.viewBackgroundColor).toBe("#fff");
		expect(cleaned.collaborators).toBeUndefined();
		expect(cleaned.editingTextElement).toBeUndefined();
		expect(cleaned.selectedElementIds).toBeUndefined();
	});

	it("omits whitelisted keys that are undefined", () => {
		const cleaned = sanitizeAppState({ scrollX: 5 }) as Record<string, unknown>;
		expect("scrollX" in cleaned).toBe(true);
		expect("zoom" in cleaned).toBe(false);
	});
});

describe("appStateSignature", () => {
	it("excludes high-frequency viewport keys (pan/zoom don't trigger a save)", () => {
		expect(APP_STATE_SIGNATURE_KEYS).not.toContain("scrollX");
		expect(APP_STATE_SIGNATURE_KEYS).not.toContain("scrollY");
		expect(APP_STATE_SIGNATURE_KEYS).not.toContain("zoom");
		// but the whitelist itself still persists them
		expect(PERSISTED_APP_STATE_KEYS).toContain("scrollX");

		const a = asAppState({ scrollX: 0, viewBackgroundColor: "#fff" });
		const b = asAppState({ scrollX: 9999, viewBackgroundColor: "#fff" });
		expect(appStateSignature(a)).toBe(appStateSignature(b));
	});

	it("changes when a persisted low-frequency setting changes", () => {
		const a = asAppState({ viewBackgroundColor: "#fff", gridModeEnabled: false });
		const b = asAppState({ viewBackgroundColor: "#000", gridModeEnabled: false });
		const c = asAppState({ viewBackgroundColor: "#fff", gridModeEnabled: true });
		expect(appStateSignature(a)).not.toBe(appStateSignature(b));
		expect(appStateSignature(a)).not.toBe(appStateSignature(c));
	});
});

describe("referencedImageFileIds", () => {
	it("collects fileIds from image elements only", () => {
		const ids = referencedImageFileIds([
			{ type: "image", fileId: "f1" },
			{ type: "rectangle" },
			{ type: "image", fileId: "f2" },
			{ type: "image" }, // no fileId
		]);
		expect([...ids].sort()).toEqual(["f1", "f2"]);
	});

	it("returns an empty set when there are no images", () => {
		expect(referencedImageFileIds([{ type: "text" }]).size).toBe(0);
	});
});
