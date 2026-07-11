import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
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
				duplicateBlock: { key: "mod+shift+D", description: "Duplicate block" },
			},
		},
	}),
}));

describe("useDocumentHotkeysConfig - move/duplicate", () => {
	it("registers moveBlockUp hotkey with mod+shift+ArrowUp", () => {
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
				editorRef,
			}),
		);

		const moveUpHotkey = result.current.find((h) => h.key === "mod+shift+ArrowUp");
		expect(moveUpHotkey).toBeDefined();
		expect(moveUpHotkey?.description).toBe("Move block up");
	});

	it("registers moveBlockDown hotkey with mod+shift+ArrowDown", () => {
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
				editorRef,
			}),
		);

		const moveDownHotkey = result.current.find((h) => h.key === "mod+shift+ArrowDown");
		expect(moveDownHotkey).toBeDefined();
		expect(moveDownHotkey?.description).toBe("Move block down");
	});

	it("registers duplicateBlock hotkey with mod+shift+D", () => {
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
				editorRef,
			}),
		);

		const duplicateHotkey = result.current.find((h) => h.key === "mod+shift+D");
		expect(duplicateHotkey).toBeDefined();
		expect(duplicateHotkey?.description).toBe("Duplicate block");
	});

	it("moveBlockUp handler calls the moveBlockUp callback", () => {
		const isActivePaneRef = { current: true };
		const editorRef = { current: null };
		const moveBlockUp = vi.fn();

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
				moveBlockUp,
				moveBlockDown: vi.fn(),
				duplicateBlock: vi.fn(),
				editorRef,
			}),
		);

		const moveUpHotkey = result.current.find((h) => h.key === "mod+shift+ArrowUp");
		const event = new KeyboardEvent("keydown", {
			key: "ArrowUp",
			ctrlKey: true,
			shiftKey: true,
		});
		moveUpHotkey?.handler(event);

		expect(moveBlockUp).toHaveBeenCalledTimes(1);
	});

	it("duplicateBlock handler calls the duplicateBlock callback", () => {
		const isActivePaneRef = { current: true };
		const editorRef = { current: null };
		const duplicateBlock = vi.fn();

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
				duplicateBlock,
				editorRef,
			}),
		);

		const duplicateHotkey = result.current.find((h) => h.key === "mod+shift+D");
		const event = new KeyboardEvent("keydown", {
			key: "D",
			ctrlKey: true,
			shiftKey: true,
		});
		duplicateHotkey?.handler(event);

		expect(duplicateBlock).toHaveBeenCalledTimes(1);
	});
});
