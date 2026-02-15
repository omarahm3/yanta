import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardHotkeysConfig } from "../hooks/useDashboardHotkeysConfig";

const mockUseMergedConfig = vi.fn();

vi.mock("@/config/usePreferencesOverrides", () => ({
	useMergedConfig: () => mockUseMergedConfig(),
}));

function createDashboardShortcuts() {
	return {
		newDocument: { key: "mod+N", description: "Create new document" },
		toggleArchived: { key: "mod+shift+A", description: "Toggle archived documents view" },
		softDelete: { key: "mod+D", description: "Soft delete selected documents" },
		permanentDelete: { key: "mod+shift+D", description: "Permanently delete selected documents" },
		toggleSelection: { key: "Space", description: "Select/deselect highlighted document" },
		openHighlighted: { key: "Enter", description: "Open highlighted document" },
		highlightNext: { key: "j", description: "Highlight next document" },
		highlightPrev: { key: "k", description: "Highlight previous document" },
		navigateDown: { key: "ArrowDown", description: "Navigate down" },
		navigateUp: { key: "ArrowUp", description: "Navigate up" },
		move: { key: "mod+M", description: "Move selected documents" },
		archive: { key: "mod+A", description: "Archive selected documents" },
		restore: { key: "mod+U", description: "Restore archived documents" },
		exportMd: { key: "mod+E", description: "Export selected documents to markdown" },
		exportPdf: { key: "mod+shift+E", description: "Export selected documents to PDF" },
	};
}

function createHookOptions() {
	return {
		handleNewDocument: vi.fn(),
		handleToggleArchived: vi.fn(),
		handleDeleteSelectedDocuments: vi.fn(),
		handleMoveSelectedDocuments: vi.fn(),
		handleToggleSelection: vi.fn(),
		handleOpenHighlightedDocument: vi.fn(),
		highlightNext: vi.fn(),
		highlightPrevious: vi.fn(),
		handleArchiveSelectedDocuments: vi.fn().mockResolvedValue(undefined),
		handleRestoreSelectedDocuments: vi.fn().mockResolvedValue(undefined),
		handleExportSelectedMarkdown: vi.fn().mockResolvedValue(undefined),
		handleExportSelectedPDF: vi.fn().mockResolvedValue(undefined),
	};
}

function createKeyboardEventStub() {
	return {
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
	} as unknown as KeyboardEvent;
}

describe("useDashboardHotkeysConfig", () => {
	beforeEach(() => {
		mockUseMergedConfig.mockReturnValue({
			shortcuts: {
				dashboard: createDashboardShortcuts(),
			},
		});
	});

	it("returns all dashboard hotkeys from merged config", () => {
		const options = createHookOptions();
		const { result } = renderHook(() => useDashboardHotkeysConfig(options));

		expect(result.current).toHaveLength(15);
		expect(result.current.every((hotkey) => hotkey.allowInInput === false)).toBe(true);
		expect(result.current.map((hotkey) => hotkey.key)).toEqual(
			expect.arrayContaining([
				"mod+N",
				"mod+shift+A",
				"mod+D",
				"mod+shift+D",
				"Space",
				"Enter",
				"j",
				"k",
				"ArrowDown",
				"ArrowUp",
				"mod+M",
				"mod+A",
				"mod+U",
				"mod+E",
				"mod+shift+E",
			]),
		);
	});

	it("routes delete hotkeys with correct hard-delete flag", () => {
		const options = createHookOptions();
		const { result } = renderHook(() => useDashboardHotkeysConfig(options));

		const softDeleteHotkey = result.current.find((hotkey) => hotkey.key === "mod+D");
		const hardDeleteHotkey = result.current.find((hotkey) => hotkey.key === "mod+shift+D");

		expect(softDeleteHotkey).toBeDefined();
		expect(hardDeleteHotkey).toBeDefined();

		const event = createKeyboardEventStub();
		act(() => {
			softDeleteHotkey?.handler(event);
			hardDeleteHotkey?.handler(event);
		});

		expect(options.handleDeleteSelectedDocuments).toHaveBeenNthCalledWith(1, false);
		expect(options.handleDeleteSelectedDocuments).toHaveBeenNthCalledWith(2, true);
		expect(event.preventDefault).toHaveBeenCalled();
		expect(event.stopPropagation).toHaveBeenCalled();
	});

	it("routes navigation and selection hotkeys", () => {
		const options = createHookOptions();
		const { result } = renderHook(() => useDashboardHotkeysConfig(options));
		const event = createKeyboardEventStub();

		const nextHotkey = result.current.find((hotkey) => hotkey.key === "j");
		const downHotkey = result.current.find((hotkey) => hotkey.key === "ArrowDown");
		const prevHotkey = result.current.find((hotkey) => hotkey.key === "k");
		const upHotkey = result.current.find((hotkey) => hotkey.key === "ArrowUp");
		const toggleSelectionHotkey = result.current.find((hotkey) => hotkey.key === "Space");
		const openHighlightedHotkey = result.current.find((hotkey) => hotkey.key === "Enter");

		act(() => {
			nextHotkey?.handler(event);
			downHotkey?.handler(event);
			prevHotkey?.handler(event);
			upHotkey?.handler(event);
			toggleSelectionHotkey?.handler(event);
			openHighlightedHotkey?.handler(event);
		});

		expect(options.highlightNext).toHaveBeenCalledTimes(2);
		expect(options.highlightPrevious).toHaveBeenCalledTimes(2);
		expect(options.handleToggleSelection).toHaveBeenCalledTimes(1);
		expect(options.handleOpenHighlightedDocument).toHaveBeenCalledTimes(1);
	});

	it("routes async action hotkeys", () => {
		const options = createHookOptions();
		const { result } = renderHook(() => useDashboardHotkeysConfig(options));
		const event = createKeyboardEventStub();

		const archiveHotkey = result.current.find((hotkey) => hotkey.key === "mod+A");
		const restoreHotkey = result.current.find((hotkey) => hotkey.key === "mod+U");
		const exportMdHotkey = result.current.find((hotkey) => hotkey.key === "mod+E");
		const exportPdfHotkey = result.current.find((hotkey) => hotkey.key === "mod+shift+E");
		const moveHotkey = result.current.find((hotkey) => hotkey.key === "mod+M");
		const newDocHotkey = result.current.find((hotkey) => hotkey.key === "mod+N");
		const toggleArchivedHotkey = result.current.find((hotkey) => hotkey.key === "mod+shift+A");

		act(() => {
			archiveHotkey?.handler(event);
			restoreHotkey?.handler(event);
			exportMdHotkey?.handler(event);
			exportPdfHotkey?.handler(event);
			moveHotkey?.handler(event);
			newDocHotkey?.handler(event);
			toggleArchivedHotkey?.handler(event);
		});

		expect(options.handleArchiveSelectedDocuments).toHaveBeenCalledTimes(1);
		expect(options.handleRestoreSelectedDocuments).toHaveBeenCalledTimes(1);
		expect(options.handleExportSelectedMarkdown).toHaveBeenCalledTimes(1);
		expect(options.handleExportSelectedPDF).toHaveBeenCalledTimes(1);
		expect(options.handleMoveSelectedDocuments).toHaveBeenCalledTimes(1);
		expect(options.handleNewDocument).toHaveBeenCalledTimes(1);
		expect(options.handleToggleArchived).toHaveBeenCalledTimes(1);
	});
});
