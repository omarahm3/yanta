import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDocumentHotkeysConfig } from "../useDocumentHotkeysConfig";

vi.mock("@/config/usePreferencesOverrides", () => ({
	useMergedConfig: () => ({
		shortcuts: {
			document: {
				save: { key: "mod+s", description: "Save document" },
				documentSearch: { key: "mod+F", description: "Find in document" },
				documentReplace: { key: "mod+H", description: "Replace in document" },
				exportMd: { key: "mod+e", description: "Export to Markdown" },
				exportPdf: { key: "mod+shift+e", description: "Export to PDF" },
				back: { key: "Escape", description: "Unfocus editor, or go back to dashboard" },
				unfocus: { key: "mod+shift+C", description: "Unfocus editor" },
				focusEditor: { key: "Enter", description: "Focus editor when unfocused" },
				deleteBlock: { key: "ctrl+d", description: "Delete block (Document page)" },
				moveBlockUp: { key: "mod+shift+ArrowUp", description: "Move block up" },
				moveBlockDown: { key: "mod+shift+ArrowDown", description: "Move block down" },
				duplicateBlock: { key: "mod+shift+d", description: "Duplicate block" },
				outline: { key: "mod+shift+o", description: "Toggle outline" },
			},
		},
	}),
}));

describe("useDocumentHotkeysConfig - deleteBlock", () => {
	it("registers a deleteBlock hotkey with ctrl+d", () => {
		const isActivePaneRef = { current: true };
		const editorRef = { current: null };

		const { result } = renderHook(() =>
			useDocumentHotkeysConfig({
				isActivePaneRef,
				isArchived: false,
				error: vi.fn(),
				saveNow: vi.fn(),
				handleExportToMarkdown: vi.fn(),
				handleExportToPDF: vi.fn(),
				handleEscape: vi.fn(),
				handleUnfocus: vi.fn(),
				focusEditor: vi.fn(),
				openFind: vi.fn(),
				openReplace: vi.fn(),
				deleteBlock: vi.fn(),
				moveBlockUp: vi.fn(),
				moveBlockDown: vi.fn(),
				duplicateBlock: vi.fn(),
				toggleOutline: vi.fn(),
				editorRef,
			}),
		);

		const deleteHotkey = result.current.find((h) => h.key === "ctrl+d");
		expect(deleteHotkey).toBeDefined();
		expect(deleteHotkey?.description).toBe("Delete block (Document page)");
	});

	it("deleteBlock handler calls the deleteBlock callback", () => {
		const isActivePaneRef = { current: true };
		const editorRef = { current: null };
		const deleteBlock = vi.fn();

		const { result } = renderHook(() =>
			useDocumentHotkeysConfig({
				isActivePaneRef,
				isArchived: false,
				error: vi.fn(),
				saveNow: vi.fn(),
				handleExportToMarkdown: vi.fn(),
				handleExportToPDF: vi.fn(),
				handleEscape: vi.fn(),
				handleUnfocus: vi.fn(),
				focusEditor: vi.fn(),
				openFind: vi.fn(),
				openReplace: vi.fn(),
				deleteBlock,
				moveBlockUp: vi.fn(),
				moveBlockDown: vi.fn(),
				duplicateBlock: vi.fn(),
				toggleOutline: vi.fn(),
				editorRef,
			}),
		);

		const deleteHotkey = result.current.find((h) => h.key === "ctrl+d");
		expect(deleteHotkey).toBeDefined();

		const event = new KeyboardEvent("keydown", { key: "d", ctrlKey: true });
		deleteHotkey?.handler(event);

		expect(deleteBlock).toHaveBeenCalledTimes(1);
	});

	it("deleteBlock handler does nothing when not active pane", () => {
		const isActivePaneRef = { current: false };
		const editorRef = { current: null };
		const deleteBlock = vi.fn();

		const { result } = renderHook(() =>
			useDocumentHotkeysConfig({
				isActivePaneRef,
				isArchived: false,
				error: vi.fn(),
				saveNow: vi.fn(),
				handleExportToMarkdown: vi.fn(),
				handleExportToPDF: vi.fn(),
				handleEscape: vi.fn(),
				handleUnfocus: vi.fn(),
				focusEditor: vi.fn(),
				openFind: vi.fn(),
				openReplace: vi.fn(),
				deleteBlock,
				moveBlockUp: vi.fn(),
				moveBlockDown: vi.fn(),
				duplicateBlock: vi.fn(),
				toggleOutline: vi.fn(),
				editorRef,
			}),
		);

		const deleteHotkey = result.current.find((h) => h.key === "ctrl+d");
		const event = new KeyboardEvent("keydown", { key: "d", ctrlKey: true });
		const returnValue = deleteHotkey?.handler(event);

		expect(returnValue).toBe(false);
		expect(deleteBlock).not.toHaveBeenCalled();
	});

	it("deleteBlock handler shows error when archived", () => {
		const isActivePaneRef = { current: true };
		const editorRef = { current: null };
		const deleteBlock = vi.fn();
		const error = vi.fn();

		const { result } = renderHook(() =>
			useDocumentHotkeysConfig({
				isActivePaneRef,
				isArchived: true,
				error,
				saveNow: vi.fn(),
				handleExportToMarkdown: vi.fn(),
				handleExportToPDF: vi.fn(),
				handleEscape: vi.fn(),
				handleUnfocus: vi.fn(),
				focusEditor: vi.fn(),
				openFind: vi.fn(),
				openReplace: vi.fn(),
				deleteBlock,
				moveBlockUp: vi.fn(),
				moveBlockDown: vi.fn(),
				duplicateBlock: vi.fn(),
				toggleOutline: vi.fn(),
				editorRef,
			}),
		);

		const deleteHotkey = result.current.find((h) => h.key === "ctrl+d");
		const event = new KeyboardEvent("keydown", { key: "d", ctrlKey: true });
		deleteHotkey?.handler(event);

		expect(deleteBlock).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledWith("Restore the document before editing.");
	});
});

describe("useDocumentHotkeysConfig - canvas gating", () => {
	const baseOptions = () => ({
		isActivePaneRef: { current: true },
		isArchived: false,
		error: vi.fn(),
		saveNow: vi.fn(),
		handleExportToMarkdown: vi.fn(),
		handleExportToPDF: vi.fn(),
		handleEscape: vi.fn(),
		handleUnfocus: vi.fn(),
		focusEditor: vi.fn(),
		openFind: vi.fn(),
		openReplace: vi.fn(),
		deleteBlock: vi.fn(),
		moveBlockUp: vi.fn(),
		moveBlockDown: vi.fn(),
		duplicateBlock: vi.fn(),
		toggleOutline: vi.fn(),
		editorRef: { current: null },
	});

	it("exposes only the Save hotkey on a canvas so Excalidraw owns the rest", () => {
		const { result } = renderHook(() =>
			useDocumentHotkeysConfig({ ...baseOptions(), isCanvas: true }),
		);

		expect(result.current).toHaveLength(1);
		expect(result.current[0].key).toBe("mod+s");
		// Keys Excalidraw needs must not be intercepted by document hotkeys.
		expect(result.current.find((h) => h.key === "Escape")).toBeUndefined();
		expect(result.current.find((h) => h.key === "ctrl+d")).toBeUndefined();
		expect(result.current.find((h) => h.key === "Enter")).toBeUndefined();
	});

	it("registers the full document hotkey set for non-canvas documents", () => {
		const { result } = renderHook(() =>
			useDocumentHotkeysConfig({ ...baseOptions(), isCanvas: false }),
		);

		expect(result.current.length).toBeGreaterThan(1);
		expect(result.current.find((h) => h.key === "Escape")).toBeDefined();
		expect(result.current.find((h) => h.key === "ctrl+d")).toBeDefined();
	});
});
