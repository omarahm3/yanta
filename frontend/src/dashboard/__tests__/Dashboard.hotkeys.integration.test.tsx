import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UseDashboardHotkeysConfigOptions } from "../hooks/useDashboardHotkeysConfig";
import { useDashboardHotkeysConfig } from "../hooks/useDashboardHotkeysConfig";
import { HotkeyProvider, useHotkeys } from "../../hotkeys";
import { isMacPlatform } from "../../hotkeys/utils/hotkeyMatcher";

const dashboardShortcuts = {
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

vi.mock("@/config/usePreferencesOverrides", () => ({
	useMergedConfig: () => ({
		shortcuts: {
			dashboard: dashboardShortcuts,
		},
	}),
}));

function createOptions(): UseDashboardHotkeysConfigOptions {
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

function HotkeysHarness({ options }: { options: UseDashboardHotkeysConfigOptions }) {
	const hotkeys = useDashboardHotkeysConfig(options);
	useHotkeys(hotkeys);
	return <input data-testid="typing-input" />;
}

const modKey = isMacPlatform() ? { metaKey: true } : { ctrlKey: true };

describe("Dashboard hotkeys integration", () => {
	it("routes navigation and selection keys through the real keydown listener", () => {
		const options = createOptions();
		render(
			<HotkeyProvider>
				<HotkeysHarness options={options} />
			</HotkeyProvider>,
		);

		fireEvent.keyDown(document, { key: "j" });
		fireEvent.keyDown(document, { key: "ArrowDown" });
		fireEvent.keyDown(document, { key: "k" });
		fireEvent.keyDown(document, { key: "ArrowUp" });
		fireEvent.keyDown(document, { key: " " });
		fireEvent.keyDown(document, { key: "Enter" });

		expect(options.highlightNext).toHaveBeenCalledTimes(2);
		expect(options.highlightPrevious).toHaveBeenCalledTimes(2);
		expect(options.handleToggleSelection).toHaveBeenCalledTimes(1);
		expect(options.handleOpenHighlightedDocument).toHaveBeenCalledTimes(1);
	});

	it("routes dashboard command hotkeys with modifiers", () => {
		const options = createOptions();
		render(
			<HotkeyProvider>
				<HotkeysHarness options={options} />
			</HotkeyProvider>,
		);

		fireEvent.keyDown(document, { key: "n", ...modKey });
		fireEvent.keyDown(document, { key: "a", shiftKey: true, ...modKey });
		fireEvent.keyDown(document, { key: "d", ...modKey });
		fireEvent.keyDown(document, { key: "d", shiftKey: true, ...modKey });

		expect(options.handleNewDocument).toHaveBeenCalledTimes(1);
		expect(options.handleToggleArchived).toHaveBeenCalledTimes(1);
		expect(options.handleDeleteSelectedDocuments).toHaveBeenNthCalledWith(1, false);
		expect(options.handleDeleteSelectedDocuments).toHaveBeenNthCalledWith(2, true);
	});

	it("does not trigger dashboard hotkeys while typing in input fields", () => {
		const options = createOptions();
		const { getByTestId } = render(
			<HotkeyProvider>
				<HotkeysHarness options={options} />
			</HotkeyProvider>,
		);

		const input = getByTestId("typing-input");
		input.focus();
		fireEvent.keyDown(input, { key: "j" });
		fireEvent.keyDown(input, { key: "Enter" });
		fireEvent.keyDown(input, { key: "d", ...modKey });

		expect(options.highlightNext).not.toHaveBeenCalled();
		expect(options.handleOpenHighlightedDocument).not.toHaveBeenCalled();
		expect(options.handleDeleteSelectedDocuments).not.toHaveBeenCalled();
	});
});
